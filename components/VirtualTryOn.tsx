
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

    // ── Parse hex → RGB for alpha-aware drawing ──────────────────────────────
    const r = parseInt(color.slice(1, 3), 16);
    const g = parseInt(color.slice(3, 5), 16);
    const b = parseInt(color.slice(5, 7), 16);

    // ── Face scale (inter-eye distance) ──────────────────────────────────────
    const eyeDist = Math.sqrt(
      Math.pow(landmarks[33].x - landmarks[263].x, 2) +
      Math.pow(landmarks[33].y - landmarks[263].y, 2)
    );
    const faceScale = eyeDist / 0.15;  // ~1.0 at normal camera distance

    // ── Project landmarks to pixel coords ────────────────────────────────────
    const toPixel = (p: any) => ({ x: p.x * canvas.width, y: p.y * canvas.height });
    const upperPx = upper.map(toPixel);
    const lowerPx = lower.map(toPixel);

    // ── Brow bounding metrics ─────────────────────────────────────────────────
    const nPts = upperPx.length;
    // Spine = midpoint between upper and lower at each index
    const spine = upperPx.map((u, i) => ({
      x: (u.x + lowerPx[i].x) / 2,
      y: (u.y + lowerPx[i].y) / 2,
      // local brow height (pixels) at this point
      h: Math.hypot(u.x - lowerPx[i].x, u.y - lowerPx[i].y),
    }));

    // Direction of brow arch at each spine point
    const browDir = spine.map((p, i) => {
      const prev = spine[Math.max(0, i - 1)];
      const next = spine[Math.min(nPts - 1, i + 1)];
      return Math.atan2(next.y - prev.y, next.x - prev.x);
    });

    const isRight = upperIdx[0] > 200;

    ctx.save();

    // ── 1. Clip tightly to the brow polygon ──────────────────────────────────
    ctx.beginPath();
    ctx.moveTo(upperPx[0].x, upperPx[0].y);
    upperPx.forEach(p => ctx.lineTo(p.x, p.y));
    [...lowerPx].reverse().forEach(p => ctx.lineTo(p.x, p.y));
    ctx.closePath();
    ctx.clip();

    // ── 2. Soft feathered base fill ───────────────────────────────────────────
    // Use a blurred filled polygon as the colour base
    ctx.save();
    ctx.filter = `blur(${Math.max(2, faceScale * 3)}px)`;
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = `rgba(${r},${g},${b},${Math.min(0.75 * intensity, 0.75)})`;
    ctx.beginPath();
    ctx.moveTo(upperPx[0].x, upperPx[0].y);
    upperPx.forEach(p => ctx.lineTo(p.x, p.y));
    [...lowerPx].reverse().forEach(p => ctx.lineTo(p.x, p.y));
    ctx.closePath();
    ctx.fill();
    ctx.filter = 'none';
    ctx.restore();

    // ── 3. Hair strand engine ─────────────────────────────────────────────────
    ctx.lineCap = 'round';
    ctx.globalCompositeOperation = 'source-over';

    const STRANDS = Math.round(120 * Math.min(intensity + 0.3, 1.0));

    for (let i = 0; i < STRANDS; i++) {
      // Random position along the brow (0 = inner/nose, 1 = outer/temple)
      const t = Math.random();
      const segF = t * (nPts - 1);
      const seg  = Math.floor(segF);
      const frac = segF - seg;
      const nextSeg = Math.min(seg + 1, nPts - 1);

      // Interpolated spine position and metrics
      const sx = spine[seg].x * (1 - frac) + spine[nextSeg].x * frac;
      const sy = spine[seg].y * (1 - frac) + spine[nextSeg].y * frac;
      const sh = spine[seg].h * (1 - frac) + spine[nextSeg].h * frac; // local height
      const dir = browDir[seg];

      // Root: random point between upper and lower at this position
      const vt = (Math.random() - 0.5) * 0.9; // -0.45 … +0.45 of local height
      const perpX = Math.cos(dir + Math.PI / 2);
      const perpY = Math.sin(dir + Math.PI / 2);
      const rootX = sx + perpX * vt * sh + (Math.random() - 0.5) * 1.5;
      const rootY = sy + perpY * vt * sh + (Math.random() - 0.5) * 1.5;

      // ── Growth direction: hair grows upward, sweeping toward the temple ──
      // Inner brow (t≈0): more vertical; outer/arch (t≈0.5): slight sweep; tail (t≈1): downward sweep
      let baseGrowAngle: number;
      if (t < 0.3) {
        // Inner head — strands grow mostly upward, slightly outward
        baseGrowAngle = isRight
          ? -Math.PI / 2 + 0.25 * (1 - t / 0.3)
          : -Math.PI / 2 - 0.25 * (1 - t / 0.3);
      } else if (t < 0.75) {
        // Body / arch — strands rise and fan toward temple
        const arch = (t - 0.3) / 0.45;
        baseGrowAngle = isRight
          ? -Math.PI / 2 + 0.15 + arch * 0.25
          : -Math.PI / 2 - 0.15 - arch * 0.25;
      } else {
        // Tail — strands sweep downward toward temple
        const tail = (t - 0.75) / 0.25;
        baseGrowAngle = isRight
          ? -Math.PI / 2 + 0.4 + tail * 0.35
          : -Math.PI / 2 - 0.4 - tail * 0.35;
      }

      const jitter = (Math.random() - 0.5) * 0.18;
      const growAngle = baseGrowAngle + jitter;

      // Hair length: 80–150 % of local brow height (stays inside clip region)
      const hairLen = sh * (0.7 + Math.random() * 0.7);

      const endX = rootX + Math.cos(growAngle) * hairLen;
      const endY = rootY + Math.sin(growAngle) * hairLen;

      // Slight natural curl via quadratic control point
      const cpX = rootX + Math.cos(growAngle) * hairLen * 0.5 + (Math.random() - 0.5) * sh * 0.15;
      const cpY = rootY + Math.sin(growAngle) * hairLen * 0.5 + (Math.random() - 0.5) * sh * 0.08;

      // Fade at brow edges
      const edgeFade = 1 - Math.pow(Math.abs(t - 0.5) * 2, 1.5);

      ctx.beginPath();
      ctx.strokeStyle = `rgba(${r},${g},${b},1)`;
      ctx.lineWidth  = Math.max(0.3, (0.5 + intensity * 1.4) * faceScale * edgeFade * (0.6 + Math.random() * 0.7));
      ctx.globalAlpha = (0.35 + intensity * 0.55) * edgeFade * (0.75 + Math.random() * 0.25);
      ctx.moveTo(rootX, rootY);
      ctx.quadraticCurveTo(cpX, cpY, endX, endY);
      ctx.stroke();
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

          // --- Parse hex color into RGB components for alpha-aware gradients ---
          const hexToRgb = (hex: string) => {
            const r = parseInt(hex.slice(1,3), 16);
            const g = parseInt(hex.slice(3,5), 16);
            const b = parseInt(hex.slice(5,7), 16);
            return { r, g, b };
          };
          const rgb = hexToRgb(color);
          const colorFull = `rgba(${rgb.r},${rgb.g},${rgb.b},1)`;
          const colorMid  = `rgba(${rgb.r},${rgb.g},${rgb.b},0.55)`;
          const colorFade = `rgba(${rgb.r},${rgb.g},${rgb.b},0)`;

          // Face scale — used to keep radius proportional regardless of distance from camera
          const leftEdge  = l[234];
          const rightEdge = l[454];
          const faceWidth = leftEdge && rightEdge
            ? Math.abs(rightEdge.x - leftEdge.x) * canvas.width
            : canvas.width * 0.5;

          // Blush radius — wide soft ellipse centred on cheek apple
          const blushRX = faceWidth * 0.30;   // horizontal radius
          const blushRY = faceWidth * 0.22;   // vertical radius (slightly squashed)

          // Shimmer highlight radius (smaller, sits on cheekbone)
          const shimmerR = faceWidth * 0.12;

          const renderBlushCheek = (appleIdx: number, boneIdx: number) => {
            const apple  = l[appleIdx];
            const bone   = l[boneIdx];
            if (!apple || !bone) return;

            const ax = apple.x * canvas.width;
            const ay = apple.y * canvas.height;
            const bx = bone.x  * canvas.width;
            const by = bone.y  * canvas.height;

            // ── Layer 1: Main blush spot (soft radial on buffer canvas) ──────────
            bCtx.save();
            bCtx.filter = 'blur(18px)';
            // Draw an ellipse scaled via transform
            bCtx.translate(ax, ay);
            bCtx.scale(1, blushRY / blushRX);
            const mainGrad = bCtx.createRadialGradient(0, 0, 0, 0, 0, blushRX);
            mainGrad.addColorStop(0,    colorFull);
            mainGrad.addColorStop(0.45, colorMid);
            mainGrad.addColorStop(1,    colorFade);
            bCtx.fillStyle = mainGrad;
            bCtx.globalAlpha = 0.92;
            bCtx.beginPath();
            bCtx.arc(0, 0, blushRX, 0, Math.PI * 2);
            bCtx.fill();
            bCtx.restore();

            // ── Layer 2: Soft mask on mask canvas (feathered circle) ─────────────
            mCtx.save();
            mCtx.filter = 'blur(20px)';
            const maskGrad = mCtx.createRadialGradient(ax, ay, 0, ax, ay, blushRX * 1.1);
            maskGrad.addColorStop(0,    'rgba(255,255,255,1)');
            maskGrad.addColorStop(0.6,  'rgba(255,255,255,0.7)');
            maskGrad.addColorStop(1,    'rgba(255,255,255,0)');
            mCtx.fillStyle = maskGrad;
            mCtx.globalAlpha = 1;
            mCtx.beginPath();
            mCtx.ellipse(ax, ay, blushRX * 1.05, blushRY * 1.05, 0, 0, Math.PI * 2);
            mCtx.fill();
            mCtx.restore();

            // ── Layer 3: Shimmer highlight on cheekbone (highlight canvas) ───────
            hCtx.save();
            hCtx.filter = 'blur(8px)';
            const shimGrad = hCtx.createRadialGradient(bx, by, 0, bx, by, shimmerR);
            shimGrad.addColorStop(0,   'rgba(255,255,255,0.9)');
            shimGrad.addColorStop(0.5, 'rgba(255,255,255,0.35)');
            shimGrad.addColorStop(1,   'rgba(255,255,255,0)');
            hCtx.fillStyle = shimGrad;
            hCtx.globalAlpha = 0.5;
            hCtx.beginPath();
            hCtx.arc(bx, by, shimmerR, 0, Math.PI * 2);
            hCtx.fill();
            hCtx.restore();
          };

          renderBlushCheek(LEFT_CHEEK_APPLE,  LEFT_CHEEK_BONE);
          renderBlushCheek(RIGHT_CHEEK_APPLE, RIGHT_CHEEK_BONE);

          // ── Composite onto the main canvas ──────────────────────────────────────
          // Apply blush buffer with multiply (blends colour into skin realistically)
          ctx.save();

          // Clip to blush mask so colour never bleeds outside cheek area
          ctx.globalCompositeOperation = 'multiply';
          ctx.globalAlpha = Math.min(blushIntensity * 0.95, 0.95);
          ctx.drawImage(bufferCanvas.current, 0, 0);

          // Colour saturation boost (screen pass adds warmth / vibrancy)
          ctx.globalCompositeOperation = 'screen';
          ctx.globalAlpha = blushIntensity * 0.22;
          ctx.drawImage(bufferCanvas.current, 0, 0);

          // Shimmer / highlight — subtle pearlescent on cheekbone
          const hShiftX = poseRef.current.yaw   * 18;
          const hShiftY = poseRef.current.pitch  * 10;
          ctx.globalCompositeOperation = 'screen';
          ctx.globalAlpha = blushIntensity * 0.45;
          ctx.drawImage(hCtx.canvas, hShiftX, hShiftY);

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
