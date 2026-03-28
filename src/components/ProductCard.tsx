import { Heart, ShoppingCart } from 'lucide-react';
import { Button } from './ui/button';
import { ImageWithFallback } from './figma/ImageWithFallback';
import { Link } from 'react-router-dom';

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

export function ProductCard({ product, onAddToCart, onToggleFavorite, isFavorite, isMobile = false }: ProductCardProps) {
  const discountPercentage = product.originalPrice 
    ? Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)
    : 0;

  const formatPrice = (price: number) => {
    return `$${(price / 100).toFixed(2)}`;
  };

  const getCategoryStyle = (category: string) => {
    const styles: Record<string, { bg: string; text: string }> = {
      'diary': { bg: 'bg-[#5f3d1e]', text: 'text-[#f59e0b]' },
      'strategy': { bg: 'bg-[#1e5f3d]', text: 'text-[#10b981]' },
      'indicator': { bg: 'bg-[#5f1e3d]', text: 'text-[#ec4899]' },
      'bot': { bg: 'bg-[#3d5f1e]', text: 'text-[#84cc16]' },
      'signal': { bg: 'bg-[#5f1e1e]', text: 'text-[#ef4444]' },
      'course': { bg: 'bg-[#1e3d5f]', text: 'text-[#3b82f6]' },
      'ebook': { bg: 'bg-[#5f3d1e]', text: 'text-[#f59e0b]' },
      'template': { bg: 'bg-[#2d2d2d]', text: 'text-[#a3a3a3]' },
      'other': { bg: 'bg-[#262626]', text: 'text-[#737373]' },
    };
    return styles[category] || styles['other'];
  };

  if (isMobile) {
    return (
      <div className="bg-[#141414] border border-[#262626] rounded-lg overflow-hidden">
        <div className="flex gap-3 p-3">
          <div className="relative flex-shrink-0 w-20 h-20 bg-[#0a0a0a] flex items-center justify-center overflow-hidden rounded">
            {product.image ? (
              <ImageWithFallback
                src={product.image}
                alt={product.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-[#d4af37] text-xl font-bold">{product.category?.charAt(0).toUpperCase()}</span>
            )}
            {discountPercentage > 0 && (
              <div className="absolute top-0 left-0 bg-[#d4af37] text-[#0a0a0a] text-[10px] font-bold px-1.5 py-0.5">
                -{discountPercentage}%
              </div>
            )}
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="mb-1">
              <span className={`inline-block px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider rounded ${getCategoryStyle(product.category).bg} ${getCategoryStyle(product.category).text}`}>
                {product.category || 'Product'}
              </span>
            </div>
            
            <h3 className="text-sm text-[#fafafa] mb-1.5 line-clamp-2 leading-snug font-medium">{product.name}</h3>
            
            <div className="flex items-baseline gap-2">
              <span className="text-base font-bold text-[#d4af37]">{formatPrice(product.price)}</span>
              {product.originalPrice && (
                <span className="text-xs text-[#737373] line-through">{formatPrice(product.originalPrice)}</span>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <Link to={`/product/${product.id}`} className="block bg-[#141414] group cursor-pointer border border-[#262626] hover:border-[#d4af37] transition-all duration-300 rounded-lg overflow-hidden">
      <div className="relative overflow-hidden aspect-square bg-[#0a0a0a]">
        {product.image ? (
          <ImageWithFallback
            src={product.image}
            alt={product.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="text-[#d4af37] text-5xl font-bold">{product.category?.charAt(0).toUpperCase()}</span>
          </div>
        )}
        <Button
          variant="ghost"
          size="sm"
          className={`absolute top-3 right-3 p-2 rounded-full bg-black/50 hover:bg-[#d4af37] ${isFavorite ? 'text-red-500' : 'text-[#fafafa]'}`}
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite(product.id);
          }}
        >
          <Heart className={`h-4 w-4 ${isFavorite ? 'fill-current' : ''}`} />
        </Button>
        {discountPercentage > 0 && (
          <div className="absolute top-3 left-3 bg-[#d4af37] text-[#0a0a0a] text-xs font-bold px-2 py-1 rounded">
            -{discountPercentage}%
          </div>
        )}
        
        {/* Add to cart button - always visible */}
        <Button
          size="sm"
          className="absolute bottom-3 left-3 right-3 bg-[#d4af37] text-[#0a0a0a] hover:bg-[#c9a432] font-semibold"
          onClick={(e) => {
            e.stopPropagation();
            onAddToCart(product);
          }}
        >
          <ShoppingCart className="h-4 w-4 mr-2" />
          Add to Cart
        </Button>
      </div>
      
      <div className="p-4">
        <div className="mb-2">
          <span className={`inline-block px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider rounded ${getCategoryStyle(product.category).bg} ${getCategoryStyle(product.category).text}`}>
            {product.category || 'Product'}
          </span>
        </div>
        
        <h3 className="text-sm text-[#fafafa] line-clamp-2 leading-snug font-medium mb-2">{product.name}</h3>
        
        <div className="flex items-baseline gap-2">
          <span className="text-lg font-bold text-[#d4af37]">{formatPrice(product.price)}</span>
          {product.originalPrice && (
            <span className="text-xs text-[#737373] line-through">{formatPrice(product.originalPrice)}</span>
          )}
        </div>
        
        {product.size && (
          <p className="text-xs text-[#737373] pt-2 uppercase">v{product.size}</p>
        )}
      </div>
    </Link>
  );
}
