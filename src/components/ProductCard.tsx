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
      'other': { bg: 'bg-[#f3f4f6]', text: 'text-[#374151]' },
    };
    return styles[category] || styles['other'];
  };

  if (isMobile) {
    return (
      <div className="bg-white border border-[#e5e5e5] rounded-lg overflow-hidden">
        <div className="flex gap-3 p-3">
          <div className="relative flex-shrink-0 w-20 h-20 bg-[#10161b] flex items-center justify-center overflow-hidden rounded">
            {product.image ? (
              <ImageWithFallback
                src={product.image}
                alt={product.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <Sparkline />
            )}
            {discountPercentage > 0 && (
              <div className="absolute top-0 left-0 bg-[#a9823a] text-white text-[10px] font-bold px-1.5 py-0.5">
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
            
            <h3 className="text-sm text-[#111111] mb-1.5 line-clamp-2 leading-snug font-medium">{product.name}</h3>
            
            <div className="flex items-baseline gap-2">
              <span className="text-base font-bold text-[#b8860b]">{formatPrice(product.price)}</span>
              {product.originalPrice && (
                <span className="text-xs text-[#6b7280] line-through">{formatPrice(product.originalPrice)}</span>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <Link to={`/product/${product.id}`} className="block bg-white card-human group cursor-pointer border border-[#e2ded4] rounded-lg overflow-hidden">
      <div className="relative overflow-hidden aspect-square bg-[#10161b]">
        {product.image ? (
          <ImageWithFallback
            src={product.image}
            alt={product.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-2">
            <Sparkline tall />
            <span className="font-terminal text-[10px] text-[#8b939a] tracking-[0.18em]">90D BACKTEST</span>
          </div>
        )}
        <Button
          variant="ghost"
          size="sm"
          className={`absolute top-3 right-3 p-2 rounded-full bg-white/70 backdrop-blur hover:bg-[#a9823a] ${isFavorite ? 'text-red-500' : 'text-[#111111]'}`}
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite(product.id);
          }}
        >
          <Heart className={`h-4 w-4 ${isFavorite ? 'fill-current' : ''}`} />
        </Button>
        {discountPercentage > 0 && (
          <div className="absolute top-3 left-3 bg-[#a9823a] text-white text-xs font-bold px-2 py-1 rounded">
            -{discountPercentage}%
          </div>
        )}
        {/* AI 분석 상품 배지 — 상세 페이지에서 USDC 결제 가능 (2026-08: 베이지로 변경) */}
        {product.category === 'AI 분석' && (
          <div className="absolute top-3 left-3 bg-[#f5efe0] text-[#8a6d3b] text-[10px] font-bold px-2 py-1 rounded uppercase tracking-wide">
            AI 분석 · USDC 결제
          </div>
        )}
        
        {/* Add to cart button - always visible */}
        <Button
          size="sm"
          className="absolute bottom-3 left-3 right-3 bg-[#a9823a] text-white hover:bg-[#8f6d2c] font-medium"
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
        
        <h3 className="text-sm text-[#1c1a17] line-clamp-2 leading-snug font-medium mb-2">{product.name}</h3>
        
        <div className="flex items-baseline gap-2">
          <span className="font-terminal text-lg font-semibold text-[#a9823a]">{formatPrice(product.price)}</span>
          {product.originalPrice && (
            <span className="text-xs text-[#6b7280] line-through">{formatPrice(product.originalPrice)}</span>
          )}
        </div>
      </div>
    </Link>
  );
}

/** 이미지 없는 상품의 미니 수익곡선 (2026-08: 플레이스홀더 문자 "A" 제거) */
export function Sparkline({ tall = false }: { tall?: boolean }) {
  return (
    <svg
      viewBox="0 0 120 48"
      className={tall ? 'h-14 w-auto' : 'h-9 w-auto'}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="spark-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#e0b565" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#e0b565" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <polyline
        points="0,38 17,30 34,34 51,22 68,26 85,14 102,18 120,6"
        fill="none"
        stroke="#e0b565"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <polygon
        points="0,38 17,30 34,34 51,22 68,26 85,14 102,18 120,6 120,48 0,48"
        fill="url(#spark-fill)"
      />
    </svg>
  );
}
