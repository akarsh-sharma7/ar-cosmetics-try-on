
import React, { useRef, useEffect, useCallback, useState } from 'react';
import { Product } from '../types';
import { WishlistIcon } from './Icons';

interface Product3DViewProps {
  product: Product;
  onClose: () => void;
}

export const Product3DView: React.FC<Product3DViewProps> = ({ product, onClose }) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const [isAdded, setIsAdded] = useState(false);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    const card = cardRef.current;
    if (!card) return;

    const { clientX, clientY } = e;
    const { top, left, width, height } = card.getBoundingClientRect();
    const xRotation = 20 * ((clientY - top - height / 2) / height);
    const yRotation = -20 * ((clientX - left - width / 2) / width);

    card.style.transform = `perspective(1000px) rotateX(${xRotation}deg) rotateY(${yRotation}deg) scale3d(1.05, 1.05, 1.05)`;
  }, []);

  const handleMouseLeave = useCallback(() => {
    const card = cardRef.current;
    if (card) {
      card.style.transform = `perspective(1000px) rotateX(0) rotateY(0) scale3d(1, 1, 1)`;
    }
  }, []);

  useEffect(() => {
    const container = document.querySelector('.modal-container');
    if (!container) return;
    
    container.addEventListener('mousemove', handleMouseMove as EventListener);
    container.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      container.removeEventListener('mousemove', handleMouseMove as EventListener);
      container.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [handleMouseMove, handleMouseLeave]);

  const handleAddToWishlist = () => {
    console.log(`Added ${product.name} to wishlist!`);
    setIsAdded(true);
    setTimeout(() => {
      setIsAdded(false);
    }, 2000);
  };

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center backdrop-blur-sm"
      onClick={onClose}
    >
      <div 
        className="modal-container flex flex-col items-center"
        onClick={e => e.stopPropagation()} // Prevent click from closing modal
      >
        <div
          ref={cardRef}
          className="w-[300px] h-[400px] bg-white rounded-2xl shadow-2xl transition-transform duration-300 ease-out"
          style={{ transformStyle: 'preserve-3d' }}
        >
          <img 
            src={product.image} 
            alt={product.name}
            className="w-full h-full object-cover rounded-2xl"
            style={{ transform: 'translateZ(20px)' }}
          />
        </div>
        <button
          onClick={handleAddToWishlist}
          disabled={isAdded}
          className={`w-[300px] mt-6 flex items-center justify-center gap-2 text-white font-bold py-3 px-4 rounded-lg transition-all duration-300 ${
            isAdded 
              ? 'bg-green-500' 
              : 'bg-pink-500 hover:bg-pink-600 transform hover:scale-105'
          }`}
          style={{ transform: 'translateZ(50px)' }}
        >
          <WishlistIcon />
          {isAdded ? 'Added to Wishlist ✓' : 'Add to Wishlist'}
        </button>
      </div>
       <button 
        onClick={onClose}
        className="absolute top-6 right-6 text-white text-4xl font-bold hover:text-pink-300 transition-colors"
        aria-label="Close 3D view"
        >
        &times;
      </button>
    </div>
  );
};