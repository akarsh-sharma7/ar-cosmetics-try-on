
import React, { useState } from 'react';
import { Product } from '../types';
import { StarIcon, ARIcon, WishlistIcon } from './Icons';
import { BRANDS } from '../constants';
import { PriceComparisonModal } from './PriceComparisonModal';

interface ProductCardProps {
  product: Product;
  onTryAR: (product: Product) => void;
  onAddToWishlist: (product: Product) => void;
}

export const ProductCard: React.FC<ProductCardProps> = ({ product, onTryAR, onAddToWishlist }) => {
  const brand = BRANDS.find(b => b.name === product.brand);
  const [isAdded, setIsAdded] = useState(false);
  const [showComparison, setShowComparison] = useState(false);

  const handleAddToWishlist = () => {
    onAddToWishlist(product);
    setIsAdded(true);
    setTimeout(() => {
      setIsAdded(false);
    }, 2000);
  };

  return (
    <>
      <div className="bg-white rounded-xl shadow-md overflow-hidden hover:shadow-2xl transition-shadow duration-300 flex flex-col">
        <div className="relative">
          <img className="w-full h-56 object-cover" src={product.image} alt={product.name} />
          
          {brand && (
            <div className="absolute top-3 left-3 bg-white/80 backdrop-blur-sm rounded-md px-2 py-1">
              <img src={brand.logo} alt={`${product.brand} logo`} className="h-6 object-contain" />
            </div>
          )}

          <div className="absolute top-3 right-3 flex flex-col items-end gap-2">
            <div className="bg-white/80 backdrop-blur-sm rounded-md px-3 py-1 text-xs font-semibold text-gray-800 flex items-center gap-1">
              <StarIcon className="w-4 h-4 text-yellow-400" />
              {product.rating}
            </div>
            <div className="bg-purple-100/90 backdrop-blur-sm text-purple-700 rounded-md px-3 py-1 text-xs font-bold flex items-center gap-1.5">
              <ARIcon />
              AR Ready
            </div>
          </div>
        </div>

        <div className="p-4 flex-grow flex flex-col">
          <h3 className="text-lg font-bold text-gray-800 truncate">{product.name}</h3>
          <p className="text-sm text-gray-600 mt-1 flex-grow">{product.description}</p>
          
          <div className="flex justify-between items-center mt-4">
              <p className="text-xl font-bold text-gray-900">₹{product.price.toLocaleString()}</p>
              <p className="text-xs text-gray-500">{product.reviews.toLocaleString()} reviews</p>
          </div>
        </div>

        <div className="p-4 pt-0 flex flex-col gap-2">
          <div className="grid grid-cols-2 gap-2">
            <button 
              onClick={() => onTryAR(product)}
              id={`try-ar-${product.id}`}
              className="w-full flex items-center justify-center gap-2 bg-pink-400 text-white font-bold py-2 px-4 rounded-lg hover:bg-pink-500 transition-transform transform hover:scale-105"
            >
              <ARIcon />
              Try with AR
            </button>
            <button 
              onClick={handleAddToWishlist}
              id={`wishlist-${product.id}`}
              disabled={isAdded}
              className={`w-full flex items-center justify-center gap-2 font-bold py-2 px-4 rounded-lg transition-all duration-300 ${
                isAdded 
                  ? 'bg-pink-500 text-white' 
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              <WishlistIcon />
              {isAdded ? 'Added ✓' : 'Wishlist'}
            </button>
          </div>

          {/* Compare Prices button */}
          <button
            onClick={() => setShowComparison(true)}
            id={`compare-prices-${product.id}`}
            className="w-full flex items-center justify-center gap-2 font-bold py-2 px-4 rounded-lg border-2 border-gray-800 text-gray-800 hover:bg-gray-800 hover:text-white transition-all duration-200 text-sm"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
              <path d="M8 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM15 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" />
              <path d="M3 4a1 1 0 00-1 1v10a1 1 0 001 1h1.05a2.5 2.5 0 014.9 0H10a1 1 0 001-1V5a1 1 0 00-1-1H3zM14 7a1 1 0 00-1 1v6.05A2.5 2.5 0 0115.95 16H17a1 1 0 001-1v-5a1 1 0 00-.293-.707l-2-2A1 1 0 0015 7h-1z" />
            </svg>
            Compare Prices
          </button>
        </div>
      </div>

      {showComparison && (
        <PriceComparisonModal
          product={product}
          onClose={() => setShowComparison(false)}
        />
      )}
    </>
  );
};