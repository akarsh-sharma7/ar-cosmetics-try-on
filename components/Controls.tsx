
import React from 'react';
import type { Product } from '../types';
import { ProductType } from '../types';

interface ControlsProps {
  products: Product[];
  activeProduct: ProductType;
  activeColor: string;
  onProductChange: (productType: ProductType) => void;
  onColorChange: (colorHex: string) => void;
  blushIntensity: number;
  onBlushIntensityChange: (intensity: number) => void;
  isCompareMode: boolean;
  onCompareToggle: () => void;
  compareColor: string;
  onCompareColorChange: (colorHex: string) => void;
}

export const Controls: React.FC<ControlsProps> = ({
  products,
  activeProduct,
  activeColor,
  onProductChange,
  onColorChange,
  blushIntensity,
  onBlushIntensityChange,
  isCompareMode,
  onCompareToggle,
  compareColor,
  onCompareColorChange,
}) => {
  const currentProduct = products.find(p => p.type === activeProduct);
  const isMascara = currentProduct?.name.toLowerCase().includes('mascara');
  const isEyebrow = activeProduct === ProductType.EYEBROW;

  return (
    <div className="bg-white p-6 rounded-lg shadow-lg space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-700 mb-3">Product</h3>
        <div className="flex gap-2 p-1 bg-gray-100 rounded-full">
          {products.map(product => (
            <button
              key={product.type}
              onClick={() => onProductChange(product.type)}
              className={`w-full py-2 px-4 rounded-full text-sm font-medium transition-colors ${
                activeProduct === product.type
                  ? 'bg-pink-500 text-white shadow'
                  : 'bg-transparent text-gray-600 hover:bg-gray-200'
              }`}
            >
              {product.type}
            </button>
          ))}
        </div>
      </div>

      {currentProduct && (
        <div>
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-lg font-semibold text-gray-700">Shades</h3>
            <div className="flex items-center">
                <span className={`mr-3 text-sm font-medium ${isCompareMode ? 'text-pink-600' : 'text-gray-500'}`}>
                    Compare Shades
                </span>
                <label htmlFor="compareToggle" className="flex items-center cursor-pointer">
                    <div className="relative">
                        <input id="compareToggle" type="checkbox" className="sr-only" checked={isCompareMode} onChange={onCompareToggle} />
                        <div className="block bg-gray-200 w-14 h-8 rounded-full"></div>
                        <div className="dot absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-transform"></div>
                    </div>
                </label>
            </div>
          </div>
          <div className="grid grid-cols-6 gap-3">
            {currentProduct.colors.map(color => {
              const isPrimary = activeColor === color.hex;
              const isSecondary = isCompareMode && compareColor === color.hex;
              let ringClass = 'border-gray-200';
              if(isPrimary) ringClass = 'border-pink-500 ring-2 ring-pink-500 ring-offset-2';
              else if (isSecondary) ringClass = 'border-blue-500 ring-2 ring-blue-500 ring-offset-2';

              return (
              <button
                key={color.hex}
                onClick={() => {
                  if (isCompareMode) {
                    if (!isPrimary) onCompareColorChange(color.hex);
                  } else {
                    onColorChange(color.hex);
                  }
                }}
                className={`w-12 h-12 rounded-full border-2 transition-transform transform hover:scale-110 ${ringClass}`}
                style={{ backgroundColor: color.hex }}
                title={color.name}
              />
            )})}
          </div>
          {isCompareMode && (
            <div className="mt-4 text-xs text-gray-500 text-center">
              <span className="font-semibold text-pink-500">Left side</span> is the primary color. Click another shade to compare on the <span className="font-semibold text-blue-500">right side</span>.
            </div>
          )}
        </div>
      )}

      {(activeProduct === ProductType.BLUSH || isEyebrow || isMascara) && (
        <div className="space-y-4">
          <div className="flex justify-between items-end">
            <h3 className="text-lg font-semibold text-gray-700">
              {isMascara ? 'Formula Effect' : isEyebrow ? 'Brow Density' : 'Intensity'}
            </h3>
            {isMascara && (
                <div className="flex gap-2">
                    {[
                        { label: 'Natural', value: 0.1 },
                        { label: 'Volume', value: 0.5 },
                        { label: 'Dramatic', value: 0.9 }
                    ].map(preset => (
                        <button
                            key={preset.label}
                            onClick={() => onBlushIntensityChange(preset.value)}
                            className={`text-[10px] px-2 py-1 rounded-full border transition-colors ${
                                Math.abs(blushIntensity - preset.value) < 0.1
                                ? 'bg-pink-100 border-pink-500 text-pink-600'
                                : 'bg-white border-gray-200 text-gray-400 hover:border-gray-400'
                            }`}
                        >
                            {preset.label}
                        </button>
                    ))}
                </div>
            )}
          </div>
          
          <div className="flex items-center gap-4">
            <input
              type="range"
              min={isMascara ? "0.0" : "0.1"}
              max="1.0"
              step="0.01"
              value={blushIntensity}
              onChange={(e) => onBlushIntensityChange(parseFloat(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-pink-500"
            />
            <span className="text-sm font-medium text-gray-600 w-12 text-center">
              {Math.round(blushIntensity * 100)}%
            </span>
          </div>
          
          <p className="text-[10px] text-gray-400 mt-2 italic text-center">
            {isMascara 
              ? blushIntensity < 0.3 ? 'High-definition separation for a natural lash look.' 
                : blushIntensity < 0.7 ? 'Increased volume with professional formula buildup.'
                : 'Dramatic, textured spider lashes for high-fashion impact.'
              : isEyebrow 
                ? 'Adjust for natural tint or bold sculpted brows.' 
                : 'Slide to adjust color visibility on skin.'}
          </p>
        </div>
      )}
    </div>
  );
};
