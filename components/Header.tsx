import React, { useContext, useState, useRef, useEffect } from 'react';
import { WishlistIcon, LoginIcon, SkinAnalysisIcon, LogoutIcon, UserCircleIcon } from './Icons';
import { AuthContext } from '../context/AuthContext';
import { Product } from '../types';

interface HeaderProps {
  onSkinAnalysisClick: () => void;
  onLoginClick: () => void;
  wishlistItems: Product[];
  onRemoveFromWishlist: (productId: number) => void;
}

export const Header: React.FC<HeaderProps> = ({ onSkinAnalysisClick, onLoginClick, wishlistItems, onRemoveFromWishlist }) => {
  const { user, loading, logout } = useContext(AuthContext);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isWishlistOpen, setIsWishlistOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const wishlistRef = useRef<HTMLDivElement>(null);

  const handleLogout = async () => {
    await logout();
    setIsDropdownOpen(false);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
      if (wishlistRef.current && !wishlistRef.current.contains(event.target as Node)) {
        setIsWishlistOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const renderAuthControls = () => {
    if (loading) {
      return <div className="h-8 w-24 bg-gray-200 rounded animate-pulse"></div>;
    }

    if (user) {
      return (
        <div className="relative" ref={dropdownRef}>
          <button onClick={() => setIsDropdownOpen(prev => !prev)} className="flex items-center gap-2">
            {user.photoURL ? (
              <img src={user.photoURL} alt="User" className="w-8 h-8 rounded-full" />
            ) : (
              <UserCircleIcon />
            )}
            <span className="hidden sm:inline font-medium text-gray-700">{user.displayName || user.email}</span>
          </button>
          {isDropdownOpen && (
            <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-50">
              <div className="px-4 py-2 text-sm text-gray-700 border-b">
                <p className="font-semibold">{user.displayName || 'Welcome'}</p>
                <p className="truncate">{user.email}</p>
              </div>
              <button
                onClick={handleLogout}
                className="w-full text-left flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-gray-100"
              >
                <LogoutIcon />
                Logout
              </button>
            </div>
          )}
        </div>
      );
    }

    return (
      <button onClick={onLoginClick} className="flex items-center gap-2 text-gray-600 hover:text-pink-500 transition-colors">
        <LoginIcon />
        <span className="hidden sm:inline">Login</span>
      </button>
    );
  };

  return (
    <header className="bg-white shadow-sm sticky top-0 z-50">
      <div className="container mx-auto px-4 py-4 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <svg className="h-8 w-8 text-pink-500" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L8 12v1c0 1.1.9 2 2 2v4.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1s-1 .45-1 1v3h-1c-1.1 0-2 .9-2 2v1h8v-1c0-.69-.35-1.3-.88-1.66l.88-2.34zM18 10c0-1.1-.9-2-2-2s-2 .9-2 2 .9 2 2 2 2-.9 2-2z" /></svg>
          <h1 className="text-2xl font-bold text-gray-800 tracking-tight">AR Shop</h1>
        </div>
        <div className="flex items-center gap-4">
          <button onClick={onSkinAnalysisClick} className="flex items-center gap-2 text-gray-600 hover:text-pink-500 transition-colors">
            <SkinAnalysisIcon />
            <span className="hidden sm:inline">Skin Analysis</span>
          </button>
          {renderAuthControls()}
          <div className="relative" ref={wishlistRef}>
            <button onClick={() => setIsWishlistOpen(prev => !prev)} className="relative flex items-center gap-2 text-gray-600 hover:text-pink-500 transition-colors">
              <WishlistIcon />
              <span className="hidden sm:inline">Wishlist</span>
              {wishlistItems.length > 0 && (
                <span className="absolute -top-2 -right-2 bg-pink-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">{wishlistItems.length}</span>
              )}
            </button>
            {isWishlistOpen && (
              <div className="absolute right-0 mt-2 w-80 bg-white rounded-md shadow-lg z-50 border">
                <div className="p-4 border-b">
                  <h3 className="font-bold text-lg text-gray-800">Your Wishlist</h3>
                </div>
                {wishlistItems.length === 0 ? (
                  <p className="p-4 text-gray-500">Your wishlist is empty.</p>
                ) : (
                  <div className="max-h-96 overflow-y-auto">
                    {wishlistItems.map(item => (
                      <div key={item.id} className="flex items-center gap-4 p-4 border-b hover:bg-gray-50">
                        <img src={item.image} alt={item.name} className="w-16 h-16 object-cover rounded-md" />
                        <div className="flex-grow">
                          <p className="font-semibold text-sm text-gray-800">{item.name}</p>
                          <p className="text-xs text-gray-500">{item.brand}</p>
                          <p className="text-sm font-bold text-gray-800 mt-1">₹{item.price.toLocaleString()}</p>
                        </div>
                        <button
                          onClick={() => onRemoveFromWishlist(item.id)}
                          className="text-red-500 hover:text-red-700 text-xs font-semibold"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};