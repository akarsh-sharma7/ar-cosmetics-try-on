
import React, { useState, useCallback, useMemo } from 'react';
import { Product, ProductType } from '../types';
import { VirtualTryOn } from './VirtualTryOn';
import { Controls } from './Controls';
import { CameraIcon } from './Icons';

interface ARTryOnViewProps {
  product: Product;
  onBack: () => void;
}

export const ARTryOnView: React.FC<ARTryOnViewProps> = ({ product, onBack }) => {
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [activeColor, setActiveColor] = useState<string>(product.colors.length > 0 ? product.colors[0].hex : '');
  const [blushIntensity, setBlushIntensity] = useState(0.5);
  const [mascaraClumpiness, setMascaraClumpiness] = useState(0.3);
  const [isCompareMode, setIsCompareMode] = useState(false);
  const [compareColor, setCompareColor] = useState<string>('');

  const isMascara = useMemo(() => product.name.toLowerCase().includes('mascara'), [product.name]);

  const handleColorChange = useCallback((colorHex: string) => {
    setActiveColor(colorHex);
  }, []);
  
  const handleBlushIntensityChange = useCallback((intensity: number) => {
    if (isMascara) {
      setMascaraClumpiness(intensity);
    } else {
      setBlushIntensity(intensity);
    }
  }, [isMascara]);

  const toggleCamera = () => {
    setIsCameraOn(prev => !prev);
  };
  
  const handleProductChange = (productType: ProductType) => {
    console.log("Product type changed to:", productType);
  };

  const handleCompareToggle = useCallback(() => {
    setIsCompareMode(prev => {
        const nextState = !prev;
        if (nextState && !compareColor) { // Entering compare mode for the first time
            const firstDifferentColor = product.colors.find(c => c.hex !== activeColor);
            setCompareColor(firstDifferentColor ? firstDifferentColor.hex : (product.colors[1]?.hex || ''));
        }
        return nextState;
    });
  }, [activeColor, compareColor, product.colors]);

  const handleCompareColorChange = useCallback((colorHex: string) => {
    setCompareColor(colorHex);
  }, []);

  return (
    <div className="flex flex-col items-center">
      <button onClick={onBack} className="mb-6 self-start bg-gray-200 text-gray-700 font-bold py-2 px-4 rounded-lg hover:bg-gray-300 transition-colors">
        &larr; Back to Catalog
      </button>
      <div className="w-full flex flex-col lg:flex-row gap-8 items-center lg:items-start justify-center">
        <div className="w-full max-w-2xl mx-auto lg:mx-0 relative">
          <VirtualTryOn 
            isCameraOn={isCameraOn}
            product={product}
            color={activeColor}
            compareColor={isCompareMode ? compareColor : undefined}
            blushIntensity={isMascara ? mascaraClumpiness : blushIntensity}
          />
          {!isCameraOn && (
             <div className="absolute inset-0 bg-black bg-opacity-50 flex flex-col justify-center items-center rounded-lg">
                <h2 className="text-2xl font-bold text-white mb-4">Virtual Try-On</h2>
                <p className="text-gray-200 mb-2">You're trying the <span className="font-bold">{product.name}</span></p>
                <p className="text-gray-200 mb-6">See how it looks on you!</p>
                <button
                    onClick={toggleCamera}
                    className="flex items-center gap-2 px-6 py-3 bg-pink-500 text-white font-semibold rounded-full shadow-lg hover:bg-pink-600 transition-transform transform hover:scale-105"
                >
                    <CameraIcon />
                    Start Camera
                </button>
             </div>
          )}
        </div>
        <div className="w-full max-w-md">
          <Controls 
            products={[product]}
            activeProduct={product.type}
            activeColor={activeColor}
            onProductChange={handleProductChange}
            onColorChange={handleColorChange}
            blushIntensity={isMascara ? mascaraClumpiness : blushIntensity}
            onBlushIntensityChange={handleBlushIntensityChange}
            isCompareMode={isCompareMode}
            onCompareToggle={handleCompareToggle}
            compareColor={compareColor}
            onCompareColorChange={handleCompareColorChange}
          />
           {isCameraOn && (
            <div className="mt-6 flex justify-center">
                <button
                    onClick={toggleCamera}
                    className="flex items-center gap-2 px-6 py-3 bg-red-500 text-white font-semibold rounded-full shadow-lg hover:bg-red-600 transition-transform transform hover:scale-105"
                >
                    <CameraIcon />
                    Stop Camera
                </button>
            </div>
           )}
        </div>
      </div>
    </div>
  );
};
