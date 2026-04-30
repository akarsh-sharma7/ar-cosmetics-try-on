
import React, { useState, useRef, useEffect, useCallback, useContext } from 'react';
import { GoogleGenAI, Type } from "@google/genai";
import { AuthContext } from '../context/AuthContext';
import { saveSkinAnalysis } from '../services/api';
import { Product } from '../types';
import { PRODUCTS } from '../constants';


interface SkinAnalysisViewProps {
  onClose: () => void;
}

interface AnalysisResult {
  skinTone: string;
  undertone: string;
  texture: string;
  pores: string;
  blemishes: string;
}

const analysisSchema = {
  type: Type.OBJECT,
  properties: {
    skinTone: { type: Type.STRING, description: 'Categorize the skin tone (e.g., Fair, Light, Medium, Tan, Dark).' },
    undertone: { type: Type.STRING, description: 'Identify the undertone (e.g., Warm, Cool, Neutral).' },
    texture: { type: Type.STRING, description: 'Describe the skin texture (e.g., Smooth, Slightly Uneven, Rough).' },
    pores: { type: Type.STRING, description: 'Describe the pore visibility (e.g., Minimal, Visible, Enlarged).' },
    blemishes: { type: Type.STRING, description: 'Note any visible blemishes (e.g., Few spots, Pigmentation, None visible).' },
  },
  required: ['skinTone', 'undertone', 'texture', 'pores', 'blemishes'],
};


export const SkinAnalysisView: React.FC<SkinAnalysisViewProps> = ({ onClose }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [isSaved, setIsSaved] = useState(false);
  const { user } = useContext(AuthContext);
  const [recommendations, setRecommendations] = useState<Product[] | null>(null);
  const [isRecommending, setIsRecommending] = useState(false);

  useEffect(() => {
    const videoElement = videoRef.current;
    let stream: MediaStream | null = null;

    navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720 } })
      .then(s => {
        stream = s;
        if (videoElement) {
          videoElement.srcObject = stream;
        }
      })
      .catch(err => {
        console.error("Camera error:", err);
        setError("Could not access the camera. Please check permissions.");
      });

    return () => {
      stream?.getTracks().forEach(track => track.stop());
    };
  }, []);

  const getRecommendations = useCallback(async (analysis: AnalysisResult) => {
    setIsRecommending(true);
    setError(null);

    const simplifiedProducts = PRODUCTS.map(({ id, name, brand, type, finish, colors }) => ({
      id,
      name,
      brand,
      type,
      finish: finish || 'N/A',
      shades: colors.map(c => c.name).join(', '),
    }));

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const prompt = `
            You are an expert virtual beauty advisor. A user has provided their skin analysis results.
            Your task is to recommend 3 to 5 products from the provided list that are the best fit for them.
            Focus on foundations and blushes that match their skin tone and undertone, and lipsticks that would be flattering.

            User's Skin Analysis:
            - Skin Tone: ${analysis.skinTone}
            - Undertone: ${analysis.undertone}
            - Texture Concerns: ${analysis.texture}, ${analysis.pores}, ${analysis.blemishes}

            Product Catalog:
            ${JSON.stringify(simplifiedProducts, null, 2)}

            Based on the analysis, select the most suitable products.
            Return your response as a JSON object containing an array of the product IDs you recommend.
            Example format: { "productIds": [10, 4, 7] }
        `;

      const recommendationSchema = {
        type: Type.OBJECT,
        properties: {
          productIds: {
            type: Type.ARRAY,
            items: {
              type: Type.NUMBER,
              description: 'The ID of a recommended product.'
            }
          }
        },
        required: ['productIds']
      };

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: recommendationSchema,
        },
      });

      const resultText = response.text.trim();
      const resultJson = JSON.parse(resultText);
      const recommendedIds = resultJson.productIds;

      if (recommendedIds && Array.isArray(recommendedIds) && recommendedIds.length > 0) {
        const recommendedProducts = PRODUCTS.filter(p => recommendedIds.includes(p.id));
        setRecommendations(recommendedProducts);
      } else {
        throw new Error("AI did not return valid recommendations.");
      }

    } catch (err) {
      console.error("Failed to get recommendations:", err);
      setError("Sorry, we couldn't generate recommendations at this time.");
      setRecommendations([]);
    } finally {
      setIsRecommending(false);
    }
  }, []);

  const fileToGenerativePart = async (file: File) => {
    const base64EncodedDataPromise = new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
      reader.readAsDataURL(file);
    });
    return {
      inlineData: { data: await base64EncodedDataPromise, mimeType: file.type },
    };
  };

  const captureFrame = (): Promise<File> => {
    return new Promise((resolve, reject) => {
      const video = videoRef.current;
      if (!video || video.readyState < 2) {
        reject("Video not ready");
        return;
      }
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject("Could not get canvas context");
        return;
      }
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(blob => {
        if (!blob) {
          reject("Could not create blob");
          return;
        }
        resolve(new File([blob], "skin_analysis_capture.jpg", { type: "image/jpeg" }));
      }, 'image/jpeg', 0.95);
    });
  };

  const handleAnalyze = async () => {
    setIsLoading(true);
    setError(null);
    setAnalysisResult(null);
    setRecommendations(null);
    setIsSaved(false);

    try {
      const imageFile = await captureFrame();
      const imagePart = await fileToGenerativePart(imageFile);
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: {
          parts: [
            imagePart,
            { text: 'Analyze the person\'s face in this image for skin characteristics. Focus on skin tone, undertone, texture, visible pores, and any blemishes. Provide the analysis in the requested JSON format.' }
          ]
        },
        config: {
          responseMimeType: "application/json",
          responseSchema: analysisSchema,
        }
      });

      const resultText = response.text.trim();
      const resultJson = JSON.parse(resultText);
      setAnalysisResult(resultJson);
      await getRecommendations(resultJson);

    } catch (err) {
      console.error("Analysis failed:", err);
      setError("An error occurred during the analysis. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveResult = async () => {
    if (!user || !analysisResult) {
      setError("You must be logged in to save results.");
      return;
    }
    try {
      // Save to MongoDB via backend API
      await saveSkinAnalysis({
        skinTone: analysisResult.skinTone,
        undertone: analysisResult.undertone,
        texture: analysisResult.texture,
        pores: analysisResult.pores,
        blemishes: analysisResult.blemishes,
      });
      setIsSaved(true);
    } catch (error) {
      console.error("Error saving document: ", error);
      setError("Could not save the analysis. Please try again.");
    }
  };

  const renderResult = () => {
    if (!analysisResult) return null;
    return (
      <div className="mt-6 bg-pink-100 p-6 rounded-lg animate-fade-in">
        <h3 className="text-xl font-bold text-gray-800 mb-4">Analysis Results</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
          {Object.entries(analysisResult).map(([key, value]) => (
            <div key={key} className="bg-white p-3 rounded-md shadow-sm">
              <p className="font-semibold text-gray-700 capitalize">{key.replace(/([A-Z])/g, ' $1')}</p>
              <p className="text-gray-600">{value}</p>
            </div>
          ))}
        </div>
        {user && !isSaved && (
          <button
            onClick={handleSaveResult}
            className="mt-6 w-full bg-green-500 text-white font-bold py-2 px-4 rounded-lg hover:bg-green-600 transition-colors"
          >
            Save Results to Profile
          </button>
        )}
        {isSaved && (
          <p className="mt-4 text-center text-green-600 font-semibold">Results saved successfully!</p>
        )}
      </div>
    );
  };

  const renderRecommendations = () => {
    if (isRecommending) {
      return (
        <div className="mt-6 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-pink-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Finding perfect matches for you...</p>
        </div>
      )
    }

    if (recommendations && recommendations.length > 0) {
      return (
        <div className="mt-8">
          <h3 className="text-xl font-bold text-gray-800 mb-4">Personalized Recommendations</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {recommendations.map(product => (
              <div key={product.id} className="bg-white rounded-lg shadow p-3 text-center">
                <img src={product.image} alt={product.name} className="w-24 h-24 object-cover mx-auto rounded-md mb-2" />
                <p className="font-semibold text-sm text-gray-800">{product.name}</p>
                <p className="text-xs text-gray-500">{product.brand}</p>
              </div>
            ))}
          </div>
        </div>
      );
    }
    if (recommendations && recommendations.length === 0 && !isRecommending) {
      return <p className="mt-4 text-center text-gray-500">Could not generate recommendations at this moment.</p>;
    }


    return null;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-2xl flex flex-col items-center relative" onClick={e => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-800 transition-colors text-3xl font-bold z-10" aria-label="Close Skin Analysis">
          &times;
        </button>
        <h2 className="text-3xl font-bold text-gray-800 mb-2">Skin Tone Analysis</h2>
        <p className="text-gray-500 mb-6 text-center">Center your face in the frame for an accurate analysis.</p>

        <div className="w-full aspect-video bg-gray-200 rounded-lg overflow-hidden relative shadow-inner">
          <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover transform scaleX-[-1]"></video>
          {isLoading && (
            <div className="absolute inset-0 bg-black bg-opacity-50 flex flex-col justify-center items-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
              <p className="text-white mt-4">Analyzing...</p>
            </div>
          )}
        </div>

        {error && <p className="text-red-500 mt-4 text-center">{error}</p>}

        {!analysisResult && (
          <button
            onClick={handleAnalyze}
            disabled={isLoading}
            className="mt-6 w-full max-w-xs bg-pink-500 text-white font-bold py-3 px-4 rounded-lg hover:bg-pink-600 transition-colors disabled:bg-gray-400"
          >
            {isLoading ? 'Analyzing...' : 'Analyze My Skin'}
          </button>
        )}

        {renderResult()}
        {renderRecommendations()}
      </div>
    </div>
  );
};
