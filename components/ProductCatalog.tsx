
import React, { useState } from 'react';
import { Product } from '../types';
import { Sidebar } from './Sidebar';
import { ProductCard } from './ProductCard';

interface ProductCatalogProps {
  products: Product[];
  onTryAR: (product: Product) => void;
  onAddToWishlist: (product: Product) => void;
  onSkinAnalysisClick: () => void;
}

export const ProductCatalog: React.FC<ProductCatalogProps> = ({ products, onTryAR, onAddToWishlist, onSkinAnalysisClick }) => {
  const [selectedBrands, setSelectedBrands] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedTechnologies, setSelectedTechnologies] = useState<string[]>([]);

  const handleBrandToggle = (brandName: string) => {
    setSelectedBrands(prev =>
      prev.includes(brandName)
        ? prev.filter(b => b !== brandName)
        : [...prev, brandName]
    );
  };

  const handleCategoryToggle = (categoryName: string) => {
    setSelectedCategories(prev =>
      prev.includes(categoryName)
        ? prev.filter(c => c !== categoryName)
        : [...prev, categoryName]
    );
  };

  const handleTechnologyToggle = (techName: string) => {
    setSelectedTechnologies(prev =>
      prev.includes(techName)
        ? prev.filter(t => t !== techName)
        : [...prev, techName]
    );
  };

  const filteredProducts = products.filter(product => {
    const brandMatch = selectedBrands.length === 0 || selectedBrands.includes(product.brand);
    const categoryMatch = selectedCategories.length === 0 || selectedCategories.includes(product.category);
    // Since none of the current products have technology tags, selecting a technology will filter out all products.
    // This allows the UI to function as a standard filter.
    const technologyMatch = selectedTechnologies.length === 0; 
    
    return brandMatch && categoryMatch && technologyMatch;
  });

  const clearFilters = () => {
    setSelectedBrands([]);
    setSelectedCategories([]);
    setSelectedTechnologies([]);
  };

  return (
    <div className="flex flex-col lg:flex-row gap-8">
      <Sidebar
        selectedBrands={selectedBrands}
        onBrandToggle={handleBrandToggle}
        selectedCategories={selectedCategories}
        onCategoryToggle={handleCategoryToggle}
        selectedTechnologies={selectedTechnologies}
        onTechnologyToggle={handleTechnologyToggle}
        onSkinAnalysisClick={onSkinAnalysisClick}
      />
      <div className="w-full">
        <div className="mb-6 p-4 bg-white rounded-lg shadow-md flex flex-col sm:flex-row justify-between items-center gap-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-800">All Products</h2>
            <p className="text-gray-500">{filteredProducts.length} products found</p>
          </div>
           {(selectedBrands.length > 0 || selectedCategories.length > 0 || selectedTechnologies.length > 0) && (
             <button
                onClick={clearFilters}
                className="bg-pink-100 text-pink-600 px-4 py-2 rounded-lg text-sm font-medium hover:bg-pink-200 transition-colors"
             >
                Clear Filters
             </button>
          )}
        </div>
        {filteredProducts.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
            {filteredProducts.map(product => (
              <ProductCard 
                key={product.id} 
                product={product} 
                onTryAR={onTryAR} 
                onAddToWishlist={onAddToWishlist} 
              />
            ))}
          </div>
        ) : (
           <div className="text-center py-20 bg-white rounded-lg shadow-md">
            <h3 className="text-2xl font-semibold text-gray-700">No Products Found</h3>
            <p className="text-gray-500 mt-2">Try adjusting your filters to see more results.</p>
          </div>
        )}
      </div>
    </div>
  );
};
