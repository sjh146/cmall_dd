import { Heart, ShoppingCart } from 'lucide-react';
import { Button } from './ui/button';
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

export function ProductCard({ product, onAddToCart, onToggleFavorite, isFavorite, isMobile = false }: ProductCardProps) {
  const discountPercentage = product.originalPrice 
    ? Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)
    : 0;

  const formatPrice = (price: number) => {
    return `$${(price / 100).toFixed(2)}`;
  };

  const getCategoryIcon = (category: string) => {
    const icons: Record<string, string> = {
      'software': '💻',
      'ebook': '📚',
      'productivity': '⚡',
      'development': '🔧',
      'design': '🎨',
      'utilities': '🔧',
      'education': '📖',
      'business': '💼',
      'lifestyle': '🌟',
      'other': '📦'
    };
    return icons[category] || '📦';
  };

  if (isMobile) {
    return (
      <div className="bg-card border-b border-border pb-4">
        <div className="flex gap-3">
          <div className="relative flex-shrink-0 w-20 h-20 bg-secondary flex items-center justify-center overflow-hidden">
            {product.image ? (
              <ImageWithFallback
                src={product.image}
                alt={product.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-2xl">{getCategoryIcon(product.category)}</span>
            )}
            {discountPercentage > 0 && (
              <div className="absolute top-0 left-0 bg-primary text-primary-foreground text-[10px] font-bold px-1.5 py-0.5">
                {discountPercentage}%
              </div>
            )}
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1 mb-0.5">
              <span className="text-xs text-muted-foreground">{getCategoryIcon(product.category)}</span>
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                {product.category || 'Product'}
              </p>
            </div>
            
            <h3 className="text-sm text-foreground mb-1.5 line-clamp-2 leading-snug font-medium">{product.name}</h3>
            
            <div className="flex items-baseline gap-1.5 mb-1">
              <span className="text-sm font-bold text-primary">{formatPrice(product.price)}</span>
              {product.originalPrice && (
                <span className="text-xs text-muted-foreground line-through">{formatPrice(product.originalPrice)}</span>
              )}
            </div>
            
            {product.size && (
              <p className="text-xs text-muted-foreground">v{product.size}</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card group cursor-pointer border border-border hover:border-primary transition-all duration-300">
      <div className="relative overflow-hidden aspect-square mb-3 bg-secondary flex items-center justify-center">
        {product.image ? (
          <ImageWithFallback
            src={product.image}
            alt={product.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <span className="text-6xl">{getCategoryIcon(product.category)}</span>
        )}
        <Button
          variant="ghost"
          size="sm"
          className={`absolute top-3 right-3 p-2 rounded-full bg-black/50 hover:bg-primary ${isFavorite ? 'text-red-500' : 'text-white'}`}
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite(product.id);
          }}
        >
          <Heart className={`h-4 w-4 ${isFavorite ? 'fill-current' : ''}`} />
        </Button>
        {discountPercentage > 0 && (
          <div className="absolute top-3 left-3 bg-primary text-primary-foreground text-xs font-bold px-2 py-1">
            {discountPercentage}% OFF
          </div>
        )}
        
        {/* Add to cart button on hover */}
        <Button
          size="sm"
          className="absolute bottom-3 left-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity bg-primary hover:bg-primary/90"
          onClick={(e) => {
            e.stopPropagation();
            onAddToCart(product);
          }}
        >
          <ShoppingCart className="h-4 w-4 mr-2" />
          Add to Cart
        </Button>
      </div>
      
      <div className="space-y-1 p-3">
        <div className="flex items-center gap-1">
          <span className="text-xs">{getCategoryIcon(product.category)}</span>
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
            {product.category || 'Product'}
          </p>
        </div>
        
        <h3 className="text-sm text-foreground line-clamp-2 leading-snug font-medium">{product.name}</h3>
        
        <div className="flex items-baseline gap-2 pt-1">
          <span className="text-lg font-bold text-primary">{formatPrice(product.price)}</span>
          {product.originalPrice && (
            <span className="text-xs text-muted-foreground line-through">{formatPrice(product.originalPrice)}</span>
          )}
        </div>
        
        {product.size && (
          <p className="text-xs text-muted-foreground pt-1 uppercase">v{product.size}</p>
        )}
      </div>
    </div>
  );
}
