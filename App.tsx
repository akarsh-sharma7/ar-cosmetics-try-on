import React, { useState, useCallback } from 'react';
import { Header } from './components/Header';
import { ProductCatalog } from './components/ProductCatalog';
import { ARTryOnView } from './components/ARTryOnView';
import { Product3DView } from './components/Product3DView';
import { SkinAnalysisView } from './components/SkinAnalysisView';
import { LoginView } from './components/LoginView';
import { Product } from './types';
import { PRODUCTS } from './constants';

const App: React.FC = () => {
  const [view, setView] = useState<'catalog' | 'ar'>('catalog');
  const [productForAR, setProductForAR] = useState<Product | null>(null);
  const [productFor3D, setProductFor3D] = useState<Product | null>(null);
  const [isSkinAnalysisVisible, setIsSkinAnalysisVisible] = useState(false);
  const [isLoginVisible, setIsLoginVisible] = useState(false);
  const [wishlistItems, setWishlistItems] = useState<Product[]>([]);

  const handleAddToWishlist = useCallback((productToAdd: Product) => {
    setWishlistItems(prevItems => {
      if (prevItems.find(item => item.id === productToAdd.id)) {
        return prevItems; // Product already in wishlist
      }
      return [...prevItems, productToAdd];
    });
  }, []);

  const handleRemoveFromWishlist = useCallback((productId: number) => {
    setWishlistItems(prevItems => prevItems.filter(item => item.id !== productId));
  }, []);

  const handleTryAR = useCallback((product: Product) => {
    setProductForAR(product);
    setView('ar');
  }, []);

  const handleBackToCatalog = useCallback(() => {
    setProductForAR(null);
    setView('ar');
    setTimeout(() => setView('catalog'), 0);
  }, []);

  const handleView3D = useCallback((product: Product) => {
    setProductFor3D(product);
  }, []);

  const handleClose3D = useCallback(() => {
    setProductFor3D(null);
  }, []);

  const handleOpenSkinAnalysis = useCallback(() => {
    setIsSkinAnalysisVisible(true);
  }, []);

  const handleCloseSkinAnalysis = useCallback(() => {
    setIsSkinAnalysisVisible(false);
  }, []);
  
  const handleOpenLogin = useCallback(() => {
    setIsLoginVisible(true);
  }, []);

  const handleCloseLogin = useCallback(() => {
    setIsLoginVisible(false);
  }, []);

  return (
    <div className="min-h-screen bg-pink-50 font-sans">
      <Header 
        onSkinAnalysisClick={handleOpenSkinAnalysis} 
        onLoginClick={handleOpenLogin}
        wishlistItems={wishlistItems}
        onRemoveFromWishlist={handleRemoveFromWishlist}
      />
      <main className="container mx-auto px-4 py-8">
        {view === 'catalog' && <ProductCatalog products={PRODUCTS} onTryAR={handleTryAR} onAddToWishlist={handleAddToWishlist} onSkinAnalysisClick={handleOpenSkinAnalysis} />}
        {view === 'ar' && productForAR && <ARTryOnView product={productForAR} onBack={handleBackToCatalog} />}
      </main>
      {productFor3D && <Product3DView product={productFor3D} onClose={handleClose3D} />}
      {isSkinAnalysisVisible && <SkinAnalysisView onClose={handleCloseSkinAnalysis} />}
      {isLoginVisible && <LoginView onClose={handleCloseLogin} />}
    </div>
  );
};

export default App;