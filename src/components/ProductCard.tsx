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
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="flex gap-3 p-3">
          <div className="relative flex-shrink-0">
            <ImageWithFallback
              src={product.image}
              alt={product.name}
              className="w-24 h-24 object-cover rounded-md"
            />
            {discountPercentage > 0 && (
              <Badge className="absolute -top-1 -left-1 bg-red-500 text-white text-xs px-1">
                -{discountPercentage}%
              </Badge>
            )}
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex justify-between items-start mb-1">
              <p className="text-xs text-gray-500">{categoryLabels[product.category] || product.category}</p>
              {product.brand && (
                <p className="text-xs font-medium text-gray-700">{product.brand}</p>
              )}
            </div>
            
            <h3 className="font-medium text-sm text-gray-900 mb-1 line-clamp-2">{product.name}</h3>
            
            <div className="flex items-center gap-2 mb-2">
              <span className="font-bold text-primary text-base">{formatPrice(product.price)}</span>
              {product.originalPrice && (
                <span className="text-xs text-gray-500 line-through">{formatPrice(product.originalPrice)}</span>
              )}
            </div>
            
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="secondary" className="text-xs">
                {conditionLabels[product.condition] || product.condition}
              </Badge>
              {product.size && (
                <span className="text-xs text-gray-600">{product.size}</span>
              )}
            </div>
            
            <div className="flex gap-2">
              <Button
                onClick={() => onAddToCart(product)}
                size="sm"
                className="flex-1 h-8 text-xs"
              >
                <ShoppingCart className="h-3 w-3 mr-1" />
                Tambah
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onToggleFavorite(product.id)}
                className={`h-8 w-8 p-0 ${isFavorite ? 'text-red-600 border-red-200' : ''}`}
              >
                <Heart className={`h-3 w-3 ${isFavorite ? 'fill-current' : ''}`} />
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow border border-gray-200 group">
      <div className="relative overflow-hidden rounded-t-lg">
        <ImageWithFallback
          src={product.image}
          alt={product.name}
          className="w-full h-48 sm:h-64 object-cover group-hover:scale-105 transition-transform duration-300"
        />
        <Button
          variant="ghost"
          size="sm"
          className={`absolute top-2 right-2 p-2 rounded-full ${isFavorite ? 'bg-red-100 text-red-600' : 'bg-white/80 text-gray-600'}`}
          onClick={() => onToggleFavorite(product.id)}
        >
          <Heart className={`h-4 w-4 ${isFavorite ? 'fill-current' : ''}`} />
        </Button>
        {discountPercentage > 0 && (
          <Badge className="absolute top-2 left-2 bg-red-500 text-white">
            -{discountPercentage}%
          </Badge>
        )}
        <Badge variant="secondary" className="absolute bottom-2 left-2">
          {conditionLabels[product.condition] || product.condition}
        </Badge>
      </div>
      
      <div className="p-3 sm:p-4">
        <div className="flex justify-between items-start mb-2">
          <p className="text-sm text-gray-500">{categoryLabels[product.category] || product.category}</p>
          {product.brand && (
            <p className="text-sm font-medium text-gray-700">{product.brand}</p>
          )}
        </div>
        
        <h3 className="font-medium text-gray-900 mb-2 line-clamp-2">{product.name}</h3>
        
        <div className="flex items-center gap-2 mb-3">
          <span className="text-base sm:text-lg font-bold text-primary">{formatPrice(product.price)}</span>
          {product.originalPrice && (
            <span className="text-sm text-gray-500 line-through">{formatPrice(product.originalPrice)}</span>
          )}
        </div>
        
        <div className="space-y-1 mb-3">
          {product.size && (
            <p className="text-sm text-gray-600">Ukuran: <span className="font-medium">{product.size}</span></p>
          )}
          {product.color && (
            <p className="text-sm text-gray-600">Warna: <span className="font-medium">{colorLabels[product.color] || product.color}</span></p>
          )}
          {product.material && (
            <p className="text-sm text-gray-600">Bahan: <span className="font-medium">{materialLabels[product.material] || product.material}</span></p>
          )}
        </div>
        
        <Button
          onClick={() => onAddToCart(product)}
          className="w-full h-10 sm:h-auto"
          size="sm"
        >
          <ShoppingCart className="h-4 w-4 mr-2" />
          Tambah ke Keranjang
        </Button>
      </div>
    </div>
  );
}