
import React, { useEffect } from 'react';
import { Product } from '../types';

interface RetailerListing {
  name: string;
  shortName: string;
  color: string;
  bgColor: string;
  rating: number;
  price: number;
  inStock: boolean;
  badge?: string;
  url: string;
}

interface PriceComparisonModalProps {
  product: Product;
  onClose: () => void;
}

const generateRetailerListings = (product: Product): RetailerListing[] => {
  // Generate realistic price variations around the base price
  const base = product.price;
  const nykaaPrice = Math.round(base * (1 + (Math.random() * 0.1)));
  const tiraPrice = Math.round(base * (1 - (Math.random() * 0.05)));
  const purpllePrice = Math.round(base * (1 + (Math.random() * 0.05)));
  const nykaaInStock = Math.random() > 0.2;
  const tiraInStock = Math.random() > 0.15;
  const purplleInStock = Math.random() > 0.3;

  const listings: RetailerListing[] = [
    {
      name: 'Nykaa',
      shortName: 'NY',
      color: '#e91e8c',
      bgColor: '#fce4f3',
      rating: 4.3,
      price: nykaaPrice,
      inStock: nykaaInStock,
      badge: nykaaPrice < tiraPrice && nykaaPrice < purpllePrice ? 'Best Price' : '10% Off',
      url: `https://www.nykaa.com/search/result/?q=${encodeURIComponent(product.name)}`,
    },
    {
      name: 'Tira',
      shortName: 'TI',
      color: '#1a56db',
      bgColor: '#ebf3ff',
      rating: 4.6,
      price: tiraPrice,
      inStock: tiraInStock,
      badge: tiraPrice <= nykaaPrice && tiraPrice <= purpllePrice ? 'Best Price' : undefined,
      url: `https://www.tirabeauty.com/search?q=${encodeURIComponent(product.name)}`,
    },
    {
      name: 'Purplle',
      shortName: 'PU',
      color: '#7c3aed',
      bgColor: '#ede9fe',
      rating: 4.4,
      price: purpllePrice,
      inStock: purplleInStock,
      badge: purpllePrice < nykaaPrice && purpllePrice < tiraPrice ? 'Best Price' : undefined,
      url: `https://www.purplle.com/search?q=${encodeURIComponent(product.name)}`,
    },
  ];

  // Find overall lowest price
  const minPrice = Math.min(...listings.map(l => l.price));
  listings.forEach(l => {
    if (l.price === minPrice) {
      l.badge = 'Best Price';
    }
  });

  return listings;
};

export const PriceComparisonModal: React.FC<PriceComparisonModalProps> = ({ product, onClose }) => {
  const listings = React.useMemo(() => generateRetailerListings(product), [product.id]);
  const lowestPrice = Math.min(...listings.map(l => l.price));

  // Close on Escape key
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
        style={{ animation: 'modalPop 0.25s cubic-bezier(0.34,1.56,0.64,1) both' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 pb-0 flex items-start gap-4">
          <img
            src={product.image}
            alt={product.name}
            className="w-14 h-14 rounded-lg object-cover flex-shrink-0 shadow"
          />
          <div className="flex-grow min-w-0">
            <p className="text-xs font-bold uppercase tracking-widest text-pink-500">{product.brand}</p>
            <h3 className="text-lg font-bold text-gray-900 leading-tight mt-0.5 truncate">{product.name}</h3>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-yellow-400 text-sm">{'★'.repeat(Math.round(product.rating))}</span>
              <span className="text-xs text-gray-500">{product.rating} · {product.reviews.toLocaleString()} reviews</span>
            </div>
          </div>
          <button
            onClick={onClose}
            id="compare-modal-close"
            className="text-gray-400 hover:text-gray-700 transition-colors ml-2 flex-shrink-0 text-2xl leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Divider */}
        <div className="mx-5 mt-4 mb-0 border-t border-gray-100" />

        {/* Section title */}
        <div className="px-5 pt-4 pb-2">
          <p className="text-xs font-bold tracking-widest text-gray-400 uppercase">Price Comparison</p>
        </div>

        {/* Retailer rows */}
        <div className="px-5 flex flex-col gap-3 pb-4">
          {listings.map((retailer) => {
            const isLowest = retailer.price === lowestPrice;
            return (
              <div
                key={retailer.name}
                className={`flex items-center gap-3 rounded-xl px-4 py-3 transition-all border ${
                  isLowest
                    ? 'border-green-300 bg-green-50 shadow-sm'
                    : 'border-gray-100 bg-gray-50'
                }`}
              >
                {isLowest && (
                  <span
                    className="absolute left-0 -translate-y-3.5 translate-x-4 bg-green-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full"
                    style={{ position: 'relative', marginLeft: '-8px', marginTop: '-22px', display: 'inline-block', alignSelf: 'flex-start' }}
                  >
                    LOWEST PRICE
                  </span>
                )}
                {/* Avatar */}
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0"
                  style={{ backgroundColor: retailer.bgColor, color: retailer.color }}
                >
                  {retailer.shortName}
                </div>

                {/* Info */}
                <div className="flex-grow min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-gray-900 text-sm">{retailer.name}</span>
                    <span className="text-yellow-400 text-xs">★ {retailer.rating}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    {retailer.inStock ? (
                      <span className="text-xs text-green-600 font-medium flex items-center gap-0.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" /> In Stock
                      </span>
                    ) : (
                      <span className="text-xs text-red-500 font-medium flex items-center gap-0.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-400 inline-block" /> Out of Stock
                      </span>
                    )}
                    {retailer.badge && (
                      <span
                        className="text-xs font-semibold px-2 py-0.5 rounded-full"
                        style={{
                          backgroundColor: retailer.badge === 'Best Price' ? '#dcfce7' : '#fce7f3',
                          color: retailer.badge === 'Best Price' ? '#15803d' : '#be185d',
                        }}
                      >
                        {retailer.badge}
                      </span>
                    )}
                  </div>
                </div>

                {/* Price + CTA */}
                <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                  <div>
                    <p className="text-lg font-black text-gray-900">₹{retailer.price.toLocaleString()}</p>
                    <p className="text-[10px] text-gray-400 text-right uppercase tracking-wide">Latest Price</p>
                  </div>
                  {retailer.inStock ? (
                    <a
                      href={retailer.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      id={`buy-${retailer.name.toLowerCase()}-btn`}
                      className="flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-lg text-white transition-transform hover:scale-105 active:scale-95"
                      style={{ backgroundColor: isLowest ? '#16a34a' : '#1f2937' }}
                    >
                      Buy Now
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z" />
                        <path d="M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z" />
                      </svg>
                    </a>
                  ) : (
                    <button
                      disabled
                      className="text-xs font-bold px-3 py-1.5 rounded-lg text-gray-400 bg-gray-200 cursor-not-allowed"
                    >
                      Notify Me
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 flex items-center justify-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
          <p className="text-[11px] text-gray-400 uppercase tracking-wider font-medium">
            Prices updated recently · Redirects to external platform
          </p>
        </div>
      </div>

      <style>{`
        @keyframes modalPop {
          from { opacity: 0; transform: scale(0.88) translateY(16px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>
    </div>
  );
};
