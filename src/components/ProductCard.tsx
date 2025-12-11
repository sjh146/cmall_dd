import { Heart, ShoppingCart } from 'lucide-react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { ImageWithFallback } from './figma/ImageWithFallback';

export interface Product {
  id: string;
  name: string;
  price: number;
  originalPrice?: number;
  image: string;
  category: string;
  condition: 'Excellent' | 'Good' | 'Fair';
  description: string;
  size?: string;
  brand?: string;
  color?: string;
  material?: string;
}

interface ProductCardProps {
  product: Product;
  onAddToCart: (product: Product) => void;
  onToggleFavorite: (productId: string) => void;
  isFavorite: boolean;
  isMobile?: boolean;
}

const categoryLabels: Record<string, string> = {
  'pants': 'Celana',
  'shirts': 'Baju & Atasan',
  'jackets': 'Jaket',
  'dresses': 'Dress'
};

const conditionLabels: Record<string, string> = {
  'Excellent': 'Sangat Baik',
  'Good': 'Baik',
  'Fair': 'Cukup Baik'
};

const colorLabels: Record<string, string> = {
  'blue': 'biru',
  'black': 'hitam',
  'white': 'putih',
  'navy': 'navy',
  'khaki': 'khaki',
  'cream': 'krem',
  'brown': 'coklat',
  'burgundy': 'merah marun',
  'floral': 'motif bunga'
};

const materialLabels: Record<string, string> = {
  'denim': 'denim',
  'cotton': 'katun',
  'wool': 'wol',
  'polyester': 'poliester',
  'acrylic': 'akrilik',
  'wool blend': 'campuran wol',
  'viscose': 'viscose',
  'corduroy': 'korduroy',
  'leather': 'kulit'
};

export function ProductCard({ product, onAddToCart, onToggleFavorite, isFavorite, isMobile = false }: ProductCardProps) {
  const discountPercentage = product.originalPrice 
    ? Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)
    : 0;

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('id-ID', { 
      style: 'currency', 
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(price);
  };

  if (isMobile) {
    return (
      <div className="bg-white border-b border-gray-100 pb-4">
        <div className="flex gap-3">
          <div className="relative flex-shrink-0 w-20 h-20">
            <ImageWithFallback
              src={product.image}
              alt={product.name}
              className="w-full h-full object-cover"
            />
            {discountPercentage > 0 && (
              <div className="absolute top-0 left-0 bg-black text-white text-[10px] font-semibold px-1.5 py-0.5">
                {discountPercentage}%
              </div>
            )}
          </div>
          
          <div className="flex-1 min-w-0">
            {product.brand && (
              <p className="text-xs text-gray-500 font-medium mb-0.5">{product.brand}</p>
            )}
            
            <h3 className="text-sm text-gray-900 mb-1.5 line-clamp-2 leading-snug">{product.name}</h3>
            
            <div className="flex items-baseline gap-1.5 mb-1">
              <span className="text-sm font-bold text-gray-900">{formatPrice(product.price)}</span>
              {product.originalPrice && (
                <span className="text-xs text-gray-400 line-through">{formatPrice(product.originalPrice)}</span>
              )}
            </div>
            
            {product.size && (
              <p className="text-xs text-gray-400">{product.size}</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white group cursor-pointer">
      <div className="relative overflow-hidden aspect-square mb-3">
        <ImageWithFallback
          src={product.image}
          alt={product.name}
          className="w-full h-full object-cover group-hover:opacity-90 transition-opacity duration-200"
        />
        <Button
          variant="ghost"
          size="sm"
          className={`absolute top-3 right-3 p-2 rounded-full bg-white/90 hover:bg-white ${isFavorite ? 'text-red-500' : 'text-gray-600'}`}
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite(product.id);
          }}
        >
          <Heart className={`h-4 w-4 ${isFavorite ? 'fill-current' : ''}`} />
        </Button>
        {discountPercentage > 0 && (
          <div className="absolute top-3 left-3 bg-black text-white text-xs font-semibold px-2 py-1">
            {discountPercentage}%
          </div>
        )}
      </div>
      
      <div className="space-y-1">
        {product.brand && (
          <p className="text-xs text-gray-500 font-medium">{product.brand}</p>
        )}
        
        <h3 className="text-sm text-gray-900 line-clamp-2 leading-snug">{product.name}</h3>
        
        <div className="flex items-baseline gap-2 pt-1">
          <span className="text-base font-bold text-gray-900">{formatPrice(product.price)}</span>
          {product.originalPrice && (
            <span className="text-xs text-gray-400 line-through">{formatPrice(product.originalPrice)}</span>
          )}
        </div>
        
        {product.size && (
          <p className="text-xs text-gray-400 pt-1">{product.size}</p>
        )}
      </div>
    </div>
  );
}