
import React, { useRef, useEffect, useCallback } from 'react';
import { FaceMesh, Results } from '@mediapipe/face_mesh';
import { Product, ProductType, LipstickFinish } from '../types';

// Precise indices for outer and inner lip boundaries
const LIP_OUTER_UPPER = [61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291];
const LIP_OUTER_LOWER = [291, 375, 321, 405, 314, 17, 84, 181, 91, 146, 61];
const LIP_INNER_UPPER = [78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 308];
const LIP_INNER_LOWER = [308, 324, 318, 402, 317, 14, 87, 178, 88, 95, 78];

// Eyelash landmarks (Upper lid ridge)
const LEFT_EYE_UPPER_LID = [246, 161, 160, 159, 158, 157, 173];
const RIGHT_EYE_UPPER_LID = [466, 388, 387, 386, 385, 384, 398];
const LEFT_EYE_LOWER_CENTROID = 145;
const RIGHT_EYE_LOWER_CENTROID = 374;
const LEFT_EYE_UPPER_CENTROID = 159;
const RIGHT_EYE_UPPER_CENTROID = 386;
const LEFT_EYE_CENTER = 468;
const RIGHT_EYE_CENTER = 473;

// Eyebrow landmarks - separated for growth direction logic
const LEFT_BROW_UPPER = [70, 63, 105, 66, 107];
const LEFT_BROW_LOWER = [46, 53, 52, 65, 55];
const RIGHT_BROW_UPPER = [300, 293, 334, 296, 336];
const RIGHT_BROW_LOWER = [276, 283, 282, 295, 285];

// Cheekbone and Temple indices for contouring
const LEFT_CHEEK_ROI = [101, 205, 116, 123, 147, 101];
const RIGHT_CHEEK_ROI = [330, 425, 345, 352, 376, 330];
const LEFT_CHEEK_APPLE = 117; 
const RIGHT_CHEEK_APPLE = 346;
const LEFT_CHEEK_BONE = 116;
const RIGHT_CHEEK_BONE = 345;
const LEFT_TEMPLE = 234;
const RIGHT_TEMPLE = 454;

declare global {
  interface Window {
    FaceMesh: typeof FaceMesh;
  }
}

interface VirtualTryOnProps {
  isCameraOn: boolean;
  product: Product;
  color: string;
  compareColor?: string;
  blushIntensity: number;
}

const SMOOTHING_FACTOR = 0.65; 

export const VirtualTryOn: React.FC<VirtualTryOnProps> = ({ isCameraOn, product, color, blushIntensity }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const faceMeshRef = useRef<FaceMesh | null>(null);
  const animationFrameId = useRef<number | null>(null);
  const isProcessing = useRef(false);
  
  const bufferCanvas = useRef<HTMLCanvasElement>(document.createElement('canvas'));
  const maskCanvas = useRef<HTMLCanvasElement>(document.createElement('canvas'));
  const highlightCanvas = useRef<HTMLCanvasElement>(document.createElement('canvas'));
  
  const smoothedLandmarks = useRef<any[] | null>(null);
  const poseRef = useRef({ yaw: 0, pitch: 0 });

  const drawPolygon = (
    ctx: CanvasRenderingContext2D,
    points: {x: number; y: number}[], 
    canvas: { width: number; height: number }
  ) => {
    if (points.length < 2) return;
    ctx.beginPath();
    ctx.moveTo(points[0].x * canvas.width, points[0].y * canvas.height);
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i].x * canvas.width, points[i].y * canvas.height);
    }
    ctx.closePath();
  };

  const drawEyebrowsRefined = (
    ctx: CanvasRenderingContext2D,
    upperIdx: number[],
    lowerIdx: number[],
    landmarks: any[],
    canvas: { width: number; height: number },
    color: string,
    intensity: number
  ) => {
    const upper = upperIdx.map(idx => landmarks[idx]);
    const lower = lowerIdx.map(idx => landmarks[idx]);
    if (!upper[0] || !lower[0]) return;

    // 1. Spine Computation & Morphological Scaling
    const spine = upper.map((up, i) => {
      const low = lower[i];
      return {
        x: (up.x + low.x) / 2,
        y: (up.y + low.y) / 2,
        thickness: Math.sqrt(Math.pow(up.x - low.x, 2) + Math.pow(up.y - low.y, 2))
      };
    });

    // Face scale adjustment (distance between eyes)
    const eyeDist = Math.sqrt(Math.pow(landmarks[33].x - landmarks[263].x, 2) + Math.pow(landmarks[33].y - landmarks[263].y, 2));
    const faceScale = eyeDist / 0.15;

    ctx.save();
    
    // 2. Layer 1: Diffused Soft Base (Feathered definition)
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = color;
    ctx.globalAlpha = intensity * 0.18;
    ctx.beginPath();
    ctx.moveTo(upper[0].x * canvas.width, upper[0].y * canvas.height);
    upper.forEach(p => ctx.lineTo(p.x * canvas.width, p.y * canvas.height));
    [...lower].reverse().forEach(p => ctx.lineTo(p.x * canvas.width, p.y * canvas.height));
    ctx.closePath();
    ctx.filter = 'blur(1px)';
    ctx.fill();
    ctx.filter = 'none';

    // 3. Layer 2: Anatomical Vector Hair Strokes
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = color;
    ctx.lineCap = 'round';
    
    const isRight = upperIdx[0] > 200;
    
    // Exact clipping to avoid "over-painting"
    ctx.beginPath();
    ctx.moveTo(upper[0].x * canvas.width, upper[0].y * canvas.height);
    upper.forEach(p => ctx.lineTo(p.x * canvas.width, p.y * canvas.height));
    [...lower].reverse().forEach(p => ctx.lineTo(p.x * canvas.width, p.y * canvas.height));
    ctx.closePath();
    ctx.clip();

    // High density sampling
    const horizontalSlices = 35; 
    const hairsPerSlice = 8;    

    for (let h = 0; h < horizontalSlices; h++) {
      const t_h = h / (horizontalSlices - 1);
      const spineIdx = Math.floor(t_h * (spine.length - 1));
      const sub_t = (t_h * (spine.length - 1)) % 1;
      
      const p1 = spine[spineIdx];
      const p2 = spine[spineIdx + 1] || p1;
      
      const localX = p1.x * (1 - sub_t) + p2.x * sub_t;
      const localY = p1.y * (1 - sub_t) + p2.y * sub_t;
      const localThickness = p1.thickness * (1 - sub_t) + p2.thickness * sub_t;

      const angleAlongSpine = Math.atan2(p2.y - p1.y, p2.x - p1.x);

      for (let v = 0; v < hairsPerSlice; v++) {
        // Vertical positioning (within the local thickness)
        const t_v = (v / (hairsPerSlice - 1) - 0.5) * 2; 
        const drift = (Math.random() - 0.5) * 0.1; // Random variation
        const rootOffset = (t_v + drift) * (localThickness * 0.45);
        
        const rootX = (localX + Math.cos(angleAlongSpine + Math.PI/2) * rootOffset) * canvas.width;
        const rootY = (localY + Math.sin(angleAlongSpine + Math.PI/2) * rootOffset) * canvas.height;

        let angleOffset;
        let lengthMod = 1.0;
        let strokeDensity = 1.0;

        // --- Anatomical Growth Field Logic ---
        if (t_h < 0.25) { 
          // INNER HEAD: Hairs grow upward and slightly outwards
          angleOffset = -Math.PI / 2 + (Math.random() - 0.5) * 0.8;
          lengthMod = 0.5 + (Math.random() * 0.3);
          strokeDensity = 0.5; // Softer head
        } else if (t_h < 0.75) { 
          // BODY & ARCH: Denser, sweeping hairs following the arch
          const isTopHalf = t_v > 0;
          const zipperEffect = isTopHalf ? 0.4 : -0.4; // Hairs meet at spine
          angleOffset = zipperEffect + (Math.random() - 0.5) * 0.3;
          lengthMod = 1.2 + (Math.random() * 0.4);
          strokeDensity = 1.3; // High definition arch
        } else { 
          // TAIL: Slanted downward, very sharp and tapered
          angleOffset = (isRight ? 0.3 : -0.3) + (Math.random() - 0.5) * 0.2;
          lengthMod = 0.8 + (Math.random() * 0.3);
          strokeDensity = 1.1;
        }

        const finalAngle = angleAlongSpine + angleOffset;
        // Stroke length proportional to local brow width
        const hairLength = (localThickness * 0.6 + Math.random() * localThickness * 0.3) * lengthMod * canvas.height * 1.8;
        
        const endX = rootX + Math.cos(finalAngle) * hairLength;
        const endY = rootY + Math.sin(finalAngle) * hairLength;

        // Visual properties for natural appearance
        const edgeFade = 1.0 - Math.abs(t_v); // Fade edges for soft transition
        ctx.beginPath();
        ctx.globalAlpha = (0.2 + intensity * 0.6) * edgeFade * strokeDensity * (0.8 + Math.random() * 0.4);
        ctx.lineWidth = (0.4 + intensity * 1.8) * faceScale * strokeDensity * edgeFade * (0.7 + Math.random() * 0.6);
        
        ctx.moveTo(rootX, rootY);
        // Add subtle curvature to individual hairs
        const cpX = rootX + Math.cos(finalAngle + 0.08) * hairLength * 0.5;
        const cpY = rootY + Math.sin(finalAngle + 0.08) * hairLength * 0.5;
        ctx.quadraticCurveTo(cpX, cpY, endX, endY);
        ctx.stroke();
      }
    }
    
    ctx.restore();
  };

  const drawMascaraLashes = (
    ctx: CanvasRenderingContext2D, 
    lidPoints: number[], 
    eyeCenterIdx: number,
    upperCentroidIdx: number,
    lowerCentroidIdx: number,
    landmarks: any[], 
    canvas: { width: number, height: number },
    color: string,
    clumpiness: number
  ) => {
    const center = landmarks[eyeCenterIdx];
    const top = landmarks[upperCentroidIdx];
    const bottom = landmarks[lowerCentroidIdx];
    
    if (!center || !top || !bottom) return;

    const openness = Math.sqrt(Math.pow(top.x - bottom.x, 2) + Math.pow(top.y - bottom.y, 2));
    const opennessFactor = Math.min(Math.max(openness / 0.045, 0), 1.2);
    const isRightEye = eyeCenterIdx === RIGHT_EYE_CENTER;

    ctx.save();
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // 1. Micro-Occlusion Shadow (Lid darkening)
    ctx.beginPath();
    ctx.lineWidth = 2.5 + (clumpiness * 3.0);
    ctx.globalAlpha = 0.3 + (clumpiness * 0.2);
    ctx.filter = 'blur(2px)';
    lidPoints.forEach((idx, i) => {
      const p = landmarks[idx];
      if (!p) return;
      if (i === 0) ctx.moveTo(p.x * canvas.width, p.y * canvas.height);
      else ctx.lineTo(p.x * canvas.width, p.y * canvas.height);
    });
    ctx.stroke();
    ctx.filter = 'none';

    // 2. Follicle Base Line
    ctx.beginPath();
    ctx.lineWidth = 1.0 + (clumpiness * 1.8);
    ctx.globalAlpha = 0.6 + (clumpiness * 0.3);
    lidPoints.forEach((idx, i) => {
      const p = landmarks[idx];
      if (!p) return;
      if (i === 0) ctx.moveTo(p.x * canvas.width, p.y * canvas.height);
      else ctx.lineTo(p.x * canvas.width, p.y * canvas.height);
    });
    ctx.stroke();

    // 3. Realistic Strand Engine
    const SUB_LASHES = 8; // Higher follicle density
    const totalLandmarks = lidPoints.length;
    const totalLashes = (totalLandmarks - 1) * SUB_LASHES;
    
    const attractionForce = Math.pow(clumpiness, 2.4) * 0.92;
    const numClumps = Math.max(4, Math.floor(totalLashes * (1.15 - (Math.pow(clumpiness, 0.45) * 0.95))));

    for (let i = 0; i < totalLandmarks - 1; i++) {
      const pStart = landmarks[lidPoints[i]];
      const pEnd = landmarks[lidPoints[i + 1]];
      if (!pStart || !pEnd) continue;

      for (let s = 0; s < SUB_LASHES; s++) {
        const ratio = s / SUB_LASHES;
        const globalT = (i * SUB_LASHES + s) / totalLashes;
        
        // Base coordinate with slight random horizontal offset for criss-cross effect
        const rootJitter = (Math.random() - 0.5) * (canvas.width * 0.001);
        const px = (pStart.x * (1 - ratio) + pEnd.x * ratio) * canvas.width + rootJitter;
        const py = (pStart.y * (1 - ratio) + pEnd.y * ratio) * canvas.height;
        const cx = center.x * canvas.width;
        const cy = center.y * canvas.height;

        let dx = px - cx;
        let dy = py - cy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        let nx = dx / dist;
        let ny = dy / dist;

        // Clumping Logic with "Sticky" pull
        if (attractionForce > 0.01) {
            const clumpIdx = Math.floor(globalT * numClumps);
            const clumpCenterT = (clumpIdx + 0.5) / numClumps;
            const pullFactor = (clumpCenterT - globalT) * 1.8;
            nx += pullFactor * attractionForce;
            ny += pullFactor * attractionForce * 0.15;
            const norm = Math.sqrt(nx*nx + ny*ny);
            nx /= norm;
            ny /= norm;
        }

        const seed = globalT * 12345.6;
        const organicJitter = Math.sin(seed) * 0.05;
        nx += organicJitter;

        // Outer-corner sweep factor
        const sweep = isRightEye 
            ? (0.4 + Math.pow(globalT, 1.3) * 0.9) 
            : (1.3 - Math.pow(globalT, 1.3) * 0.9);
            
        const baseLength = canvas.height * 0.027;
        const variation = 0.75 + (Math.cos(seed * 0.7) * 0.3);
        const lashLength = baseLength * sweep * variation * (0.35 + opennessFactor * 0.7);
        const curl = lashLength * (0.5 + opennessFactor * 0.45);

        // Anatomical Thickness (Tapered)
        const rootWidth = (0.8 + clumpiness * 5.2) * (0.9 + opennessFactor * 0.1);
        
        // Multi-point spline for better curvature
        const midX = px + nx * lashLength * 0.5;
        const midY = py + ny * lashLength * 0.5 - curl * 0.65;
        
        // "Tip Fuzzing" - randomize tip end slightly
        const tipJitter = (Math.random() - 0.5) * (rootWidth * 0.8);
        const endX = px + nx * lashLength + tipJitter;
        const endY = py + ny * lashLength - curl * 0.85;

        // Render Triple-Tapered Path
        // 1. Thick Base
        ctx.beginPath();
        ctx.lineWidth = rootWidth;
        ctx.globalAlpha = 0.95;
        ctx.moveTo(px, py);
        ctx.quadraticCurveTo(midX, midY, px + (endX - px) * 0.45, py + (endY - py) * 0.45);
        ctx.stroke();

        // 2. Medium Body
        ctx.beginPath();
        ctx.lineWidth = rootWidth * 0.55;
        ctx.globalAlpha = 0.85;
        ctx.moveTo(px + (endX - px) * 0.4, py + (endY - py) * 0.4);
        ctx.quadraticCurveTo(midX, midY, px + (endX - px) * 0.8, py + (endY - py) * 0.8);
        ctx.stroke();

        // 3. Fine Tip
        ctx.beginPath();
        ctx.lineWidth = Math.max(0.2, rootWidth * 0.2);
        ctx.globalAlpha = 0.7;
        ctx.moveTo(px + (endX - px) * 0.75, py + (endY - py) * 0.75);
        ctx.quadraticCurveTo(midX, midY, endX, endY);
        ctx.stroke();

        // 4. Subtle Wet Specular (Mascara gloss)
        if (Math.sin(seed * 0.15) > 0.6) {
            ctx.beginPath();
            ctx.strokeStyle = '#FFFFFF';
            ctx.globalAlpha = 0.18 * (1.0 - clumpiness * 0.2);
            ctx.lineWidth = rootWidth * 0.2;
            ctx.moveTo(px + (midX - px) * 0.2, py + (midY - py) * 0.2);
            ctx.lineTo(px + (midX - px) * 0.45, py + (midY - py) * 0.45);
            ctx.stroke();
            ctx.strokeStyle = color; // Restore
        }

        // 5. Inter-Lash Stray Strands (Random finer hairs)
        if (Math.random() > 0.92) {
            const strayLen = lashLength * 0.7;
            const strayNx = nx + (Math.random() - 0.5) * 0.5;
            const strayNy = ny + (Math.random() - 0.5) * 0.3;
            const sx = px + strayNx * strayLen;
            const sy = py + strayNy * strayLen - curl * 0.3;
            
            ctx.beginPath();
            ctx.lineWidth = 0.35;
            ctx.globalAlpha = 0.35;
            ctx.moveTo(px, py);
            ctx.bezierCurveTo(px, py, px + (sx - px) * 0.5, py + (sy - py) * 0.5 - 4, sx, sy);
            ctx.stroke();
        }
      }
    }
    ctx.restore();
  };

  const onResults = useCallback((results: Results) => {
    isProcessing.current = false;
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video || video.readyState < 2) return;

    if (canvas.width !== video.videoWidth) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      [bufferCanvas, maskCanvas, highlightCanvas].forEach(ref => {
        ref.current.width = canvas.width;
        ref.current.height = canvas.height;
      });
    }

    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    ctx.drawImage(video, 0, 0);

    if (results && results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
      const landmarks = results.multiFaceLandmarks[0];
      if (!landmarks) return;

      if (!smoothedLandmarks.current) {
        smoothedLandmarks.current = JSON.parse(JSON.stringify(landmarks));
      } else {
        const s = 1 - SMOOTHING_FACTOR;
        for (let i = 0; i < landmarks.length; i++) {
          if (smoothedLandmarks.current[i] && landmarks[i]) {
            smoothedLandmarks.current[i].x = smoothedLandmarks.current[i].x * SMOOTHING_FACTOR + landmarks[i].x * s;
            smoothedLandmarks.current[i].y = smoothedLandmarks.current[i].y * SMOOTHING_FACTOR + landmarks[i].y * s;
          }
        }
      }

      const l = smoothedLandmarks.current;
      const nose = l[1];
      const leftFaceEdge = l[234];
      const rightFaceEdge = l[454];
      const chin = l[152];
      const forehead = l[10];

      if (nose && leftFaceEdge && rightFaceEdge && chin && forehead) {
        poseRef.current.yaw = (nose.x - (leftFaceEdge.x + rightFaceEdge.x) / 2) / (rightFaceEdge.x - leftFaceEdge.x);
        poseRef.current.pitch = (nose.y - (forehead.y + chin.y) / 2) / (chin.y - forehead.y);
      }

      const bCtx = bufferCanvas.current.getContext('2d');
      const mCtx = maskCanvas.current.getContext('2d');
      const hCtx = highlightCanvas.current.getContext('2d');

      if (bCtx && mCtx && hCtx) {
        if (product.type === ProductType.LIPSTICK) {
          bCtx.clearRect(0, 0, canvas.width, canvas.height);
          mCtx.clearRect(0, 0, canvas.width, canvas.height);
          hCtx.clearRect(0, 0, canvas.width, canvas.height);

          const outerPath = [...LIP_OUTER_UPPER, ...LIP_OUTER_LOWER].map(i => l[i]);
          const innerPath = [...LIP_INNER_UPPER, ...LIP_INNER_LOWER].map(i => l[i]);

          mCtx.fillStyle = 'white';
          drawPolygon(mCtx, outerPath, canvas);
          mCtx.fill();
          mCtx.globalCompositeOperation = 'destination-out';
          drawPolygon(mCtx, innerPath, canvas);
          mCtx.fill();
          mCtx.globalCompositeOperation = 'source-over';

          hCtx.drawImage(video, 0, 0);
          hCtx.globalCompositeOperation = 'multiply';
          hCtx.fillStyle = '#666'; 
          hCtx.fillRect(0, 0, canvas.width, canvas.height);
          hCtx.globalCompositeOperation = 'destination-in';
          hCtx.drawImage(maskCanvas.current, 0, 0);

          const finish = product.finish || LipstickFinish.MATTE;
          
          bCtx.globalCompositeOperation = 'source-over';
          bCtx.fillStyle = color;
          drawPolygon(bCtx, outerPath, canvas);
          bCtx.fill();
          bCtx.globalCompositeOperation = 'multiply';
          bCtx.drawImage(video, 0, 0);

          bCtx.globalCompositeOperation = 'soft-light';
          bCtx.globalAlpha = 0.8;
          bCtx.fillStyle = color;
          drawPolygon(bCtx, outerPath, canvas);
          bCtx.fill();
          bCtx.globalAlpha = 1.0;

          bCtx.globalCompositeOperation = 'screen';
          bCtx.globalAlpha = finish === LipstickFinish.MATTE ? 0.2 : 0.6;
          bCtx.drawImage(highlightCanvas.current, 0, 0);
          bCtx.globalAlpha = 1.0;

          if (finish === LipstickFinish.GLOSSY || finish === LipstickFinish.METALLIC) {
            bCtx.globalCompositeOperation = 'screen';
            const lightX = (0.5 - poseRef.current.yaw * 0.6) * canvas.width;
            const lightY = (0.4 + poseRef.current.pitch * 0.4) * canvas.height;
            const glossRad = canvas.height * 0.2;
            
            const grad = bCtx.createRadialGradient(lightX, lightY, 0, lightX, lightY, glossRad);
            const intensity = finish === LipstickFinish.GLOSSY ? 0.35 : 0.15;
            grad.addColorStop(0, `rgba(255, 255, 255, ${intensity})`);
            grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
            
            bCtx.fillStyle = grad;
            drawPolygon(bCtx, outerPath, canvas);
            bCtx.fill();
          }

          bCtx.globalCompositeOperation = 'destination-in';
          bCtx.drawImage(maskCanvas.current, 0, 0);

          ctx.globalAlpha = 0.96; 
          ctx.drawImage(bufferCanvas.current, 0, 0);
          ctx.globalAlpha = 1.0;

        } else if (product.type === ProductType.BLUSH) {
          bCtx.clearRect(0, 0, canvas.width, canvas.height);
          mCtx.clearRect(0, 0, canvas.width, canvas.height);
          hCtx.clearRect(0, 0, canvas.width, canvas.height);

          const leftCheekPath = LEFT_CHEEK_ROI.map(i => l[i]);
          const rightCheekPath = RIGHT_CHEEK_ROI.map(i => l[i]);

          const renderContouredCheek = (appleIdx: number, boneIdx: number, templeIdx: number, path: any[]) => {
            const apple = l[appleIdx];
            const bone = l[boneIdx];
            const temple = l[templeIdx];
            if (!apple || !bone || !temple) return;

            const ax = apple.x * canvas.width;
            const ay = apple.y * canvas.height;
            const bx = bone.x * canvas.width;
            const by = bone.y * canvas.height;
            const tx = temple.x * canvas.width;
            const ty = temple.y * canvas.height;
            
            const sweepGrad = bCtx.createLinearGradient(ax, ay, tx, ty);
            sweepGrad.addColorStop(0, 'rgba(0,0,0,0)');
            sweepGrad.addColorStop(0.35, color); 
            sweepGrad.addColorStop(1, 'rgba(0,0,0,0)');
            
            bCtx.save();
            bCtx.fillStyle = sweepGrad;
            drawPolygon(bCtx, path, canvas);
            bCtx.clip();
            
            const radialSpot = bCtx.createRadialGradient(bx, by, 0, bx, by, canvas.width * 0.18);
            radialSpot.addColorStop(0, color);
            radialSpot.addColorStop(1, 'rgba(0,0,0,0)');
            
            bCtx.globalAlpha = 0.75;
            bCtx.fillStyle = radialSpot;
            bCtx.fill();
            bCtx.restore();

            mCtx.save();
            const maskGrad = mCtx.createRadialGradient(bx, by, 0, bx, by, canvas.width * 0.14);
            maskGrad.addColorStop(0, 'white');
            maskGrad.addColorStop(1, 'rgba(255,255,255,0)');
            mCtx.fillStyle = maskGrad;
            drawPolygon(mCtx, path, canvas);
            mCtx.clip();
            mCtx.fillRect(0,0, canvas.width, canvas.height);
            mCtx.restore();
          };

          renderContouredCheek(LEFT_CHEEK_APPLE, LEFT_CHEEK_BONE, LEFT_TEMPLE, leftCheekPath);
          renderContouredCheek(RIGHT_CHEEK_APPLE, RIGHT_CHEEK_BONE, RIGHT_TEMPLE, rightCheekPath);

          hCtx.drawImage(video, 0, 0);
          hCtx.globalCompositeOperation = 'multiply';
          hCtx.fillStyle = '#D0D0D0'; 
          hCtx.fillRect(0, 0, canvas.width, canvas.height);
          hCtx.globalCompositeOperation = 'source-atop';
          hCtx.fillStyle = color; 
          hCtx.fillRect(0, 0, canvas.width, canvas.height);
          hCtx.globalCompositeOperation = 'destination-in';
          hCtx.drawImage(maskCanvas.current, 0, 0);

          ctx.save();
          ctx.globalCompositeOperation = 'soft-light';
          ctx.globalAlpha = blushIntensity;
          ctx.drawImage(bufferCanvas.current, 0, 0);
          
          const hShiftX = poseRef.current.yaw * 28; 
          const hShiftY = poseRef.current.pitch * 16;
          
          ctx.globalCompositeOperation = 'screen';
          ctx.globalAlpha = blushIntensity * 0.7; 
          ctx.drawImage(highlightCanvas.current, hShiftX, hShiftY);

          ctx.globalCompositeOperation = 'overlay';
          ctx.globalAlpha = blushIntensity * 0.3;
          ctx.drawImage(highlightCanvas.current, hShiftX * 1.5, hShiftY * 1.5);
          
          ctx.restore();
        } else if (product.type === ProductType.EYEBROW) {
          drawEyebrowsRefined(ctx, LEFT_BROW_UPPER, LEFT_BROW_LOWER, l, canvas, color, blushIntensity);
          drawEyebrowsRefined(ctx, RIGHT_BROW_UPPER, RIGHT_BROW_LOWER, l, canvas, color, blushIntensity);
        } else if (product.type === ProductType.EYESHADOW || product.name.toLowerCase().includes('mascara')) {
          ctx.save();
          drawMascaraLashes(ctx, LEFT_EYE_UPPER_LID, LEFT_EYE_CENTER, LEFT_EYE_UPPER_CENTROID, LEFT_EYE_LOWER_CENTROID, l, canvas, color, blushIntensity);
          drawMascaraLashes(ctx, RIGHT_EYE_UPPER_LID, RIGHT_EYE_CENTER, RIGHT_EYE_UPPER_CENTROID, RIGHT_EYE_LOWER_CENTROID, l, canvas, color, blushIntensity);
          ctx.restore();
        }
      }
    }

    if (isCameraOn) {
      animationFrameId.current = requestAnimationFrame(() => {
        if (!isProcessing.current && faceMeshRef.current && videoRef.current && videoRef.current.readyState >= 2) {
          isProcessing.current = true;
          faceMeshRef.current.send({ image: videoRef.current }).catch(() => {
              isProcessing.current = false;
          });
        }
      });
    }
  }, [isCameraOn, color, product, blushIntensity]);

  useEffect(() => {
    if (isCameraOn) {
      faceMeshRef.current = new window.FaceMesh({
        locateFile: (file) => {
          return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh@0.4.1633559619/${file}`;
        },
      });
      
      faceMeshRef.current.setOptions({
        maxNumFaces: 1,
        refineLandmarks: true,
        minDetectionConfidence: 0.6,
        minTrackingConfidence: 0.6,
      });
      
      faceMeshRef.current.onResults(onResults);
      
      if (videoRef.current) {
        navigator.mediaDevices.getUserMedia({ 
          video: { 
            width: { ideal: 1280 }, 
            height: { ideal: 720 }, 
            frameRate: { ideal: 30 }
          } 
        })
          .then((stream) => {
            if (videoRef.current) {
              videoRef.current.srcObject = stream;
              videoRef.current.onloadedmetadata = () => {
                videoRef.current?.play();
                if (faceMeshRef.current) {
                    isProcessing.current = true;
                    faceMeshRef.current.send({ image: videoRef.current! }).catch(() => {
                        isProcessing.current = false;
                    });
                }
              };
            }
          }).catch(console.error);
      }
    }
    return () => {
      if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
      if (faceMeshRef.current) faceMeshRef.current.close();
      if (videoRef.current?.srcObject) (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
    };
  }, [isCameraOn, onResults]);

  return (
    <div className="aspect-video w-full relative bg-black rounded-xl overflow-hidden shadow-2xl group border-2 border-white/20">
      <video ref={videoRef} autoPlay playsInline muted className="hidden" />
      <canvas ref={canvasRef} className="w-full h-full object-cover transform scale-x-[-1]" />
      
      <div className="absolute top-4 left-4 flex flex-col gap-2">
        <div className="flex items-center gap-2 px-3 py-1 bg-black/40 backdrop-blur-md rounded-full border border-white/20">
          <div className="w-2 h-2 rounded-full bg-pink-500 animate-pulse" />
          <span className="text-[10px] font-bold text-white uppercase tracking-widest text-shadow">
            {product.type === ProductType.EYEBROW ? 'HD Anatomical Brow Engine' : product.name.toLowerCase().includes('mascara') ? 'High-Fidelity Follicle Engine' : 'PBR Skin Core'}
          </span>
        </div>
      </div>
    </div>
  );
};
