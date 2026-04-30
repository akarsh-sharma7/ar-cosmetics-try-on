import React from 'react';
import { BRANDS } from '../constants';

const occasions = ['Daily', 'Work', 'Evening', 'Special', 'Wedding', 'Party', 'Date'];

const categories = [
  { name: 'Face', image: 'https://www.shutterstock.com/image-vector/beauty-face-woman-logo-vector-260nw-2493789625.jpg' },
  { name: 'Eyes', image: 'https://www.shutterstock.com/image-vector/eyelashes-logo-icon-design-template-260nw-1507987082.jpg' },
  { name: 'Cheeks', image: 'https://static.vecteezy.com/system/resources/previews/002/378/022/non_2x/woman-face-logo-free-vector.jpg' },
  { name: 'Lips', image: 'https://images.vexels.com/media/users/3/140984/isolated/svg/8f233c7e81bd92cf419c51085e35cca9.svg' },
];

interface SidebarProps {
  selectedBrands: string[];
  onBrandToggle: (brandName: string) => void;
  selectedCategories: string[];
  onCategoryToggle: (categoryName: string) => void;
  onSkinAnalysisClick: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  selectedBrands,
  onBrandToggle,
  selectedCategories,
  onCategoryToggle,
  onSkinAnalysisClick
}) => {
  return (
    <aside className="w-full lg:w-1/4 xl:w-1/5 space-y-8">

      {/* Category Filter */}
      <div className="bg-white p-6 rounded-lg shadow-md">
        <h3 className="text-lg font-semibold text-gray-800 mb-4 border-b pb-2">Categories</h3>
        <div className="grid grid-cols-2 gap-4">
          {categories.map(category => (
            <div 
              key={category.name} 
              onClick={() => onCategoryToggle(category.name)}
              className={`flex flex-col items-center p-2 rounded-lg cursor-pointer transition-all duration-200 border-2 ${
                selectedCategories.includes(category.name) 
                  ? 'border-pink-400 bg-pink-100' 
                  : 'border-transparent hover:bg-pink-100'
              }`}
            >
              <img src={category.image} alt={category.name} className="w-20 h-20 object-cover rounded-full shadow-sm mb-2" />
              <span className="text-sm font-medium text-gray-700">{category.name}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Brand Filter */}
      <div className="bg-white p-6 rounded-lg shadow-md">
        <h3 className="text-lg font-semibold text-gray-800 mb-4 border-b pb-2">Brands</h3>
        <div className="grid grid-cols-2 gap-2">
          {BRANDS.map(brand => (
            <div 
              key={brand.name} 
              onClick={() => onBrandToggle(brand.name)}
              className={`flex flex-col items-center justify-center p-2 rounded-lg cursor-pointer transition-all duration-200 border-2 h-28 ${
                selectedBrands.includes(brand.name) 
                  ? 'border-pink-400 bg-pink-100' 
                  : 'border-transparent hover:bg-pink-100'
              }`}
            >
              <img src={brand.logo} alt={`${brand.name} logo`} className="max-w-full max-h-16 object-contain" />
              <span className="text-xs font-medium text-gray-700 mt-2 text-center">{brand.name}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Occasions Filter */}
      <div className="bg-white p-6 rounded-lg shadow-md">
        <h3 className="text-lg font-semibold text-gray-800 mb-4 border-b pb-2">Occasions</h3>
        <div className="space-y-3">
          {occasions.map(occasion => (
            <label key={occasion} className="flex items-center space-x-3 cursor-pointer">
              <input type="checkbox" className="h-4 w-4 rounded border-gray-300 text-pink-500 focus:ring-pink-500" />
              <span className="text-gray-600">{occasion}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Skin Tone Analysis */}
      <div className="bg-white p-6 rounded-lg shadow-md text-center">
         <div className="flex justify-center items-center mb-4">
            <div className="w-16 h-16 bg-pink-100 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-pink-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                  d="M12 4v.01M12 8v4m0 4v.01M4.93 4.93l.01.01M19.07 19.07l-.01-.01M4.93 19.07l.01-.01M19.07 4.93l-.01.01"/>
                </svg>
            </div>
        </div>
        <h3 className="text-lg font-semibold text-gray-800 mb-2">Get Personalized Recommendations</h3>
        <p className="text-gray-500 text-sm mb-6">Analyze your skin tone for better color matching.</p>
        <button 
          onClick={onSkinAnalysisClick}
          className="w-full bg-pink-400 text-white font-bold py-2 px-4 rounded-lg hover:bg-pink-500 transition-colors"
        >
          Analyze Skin Tone
        </button>
      </div>

    </aside>
  );
};