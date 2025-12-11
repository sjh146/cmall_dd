import React, { useState, useMemo } from 'react';
import { Header } from './components/Header';
import { HeroSection } from './components/HeroSection';
import { ProductCard, Product } from './components/ProductCard';
import { ShoppingCart, CartItem } from './components/ShoppingCart';
import { ProductFilters, FilterOptions } from './components/ProductFilters';
import { MobileFilters } from './components/MobileFilters';
import { Button } from './components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './components/ui/select';
import { Grid, List } from 'lucide-react';

// Mock clothing product data for 307 Second in Indonesian with Rupiah prices
const mockProducts: Product[] = [
  {
    id: '1',
    name: 'Celana Jeans Vintage Levi\'s 501',
    price: 675000,
    originalPrice: 1335000,
    image: '/images/🇰🇷🇷🇸Korean-Serbian Couple Q&A： Marriage, How We Met & Life Together ｜ 한국 세르비아인 커플_frame_1-30.jpg',
    category: 'pants',
    condition: 'Good',
    description: 'Celana jeans vintage Levi\'s 501 klasik dalam kondisi sangat baik',
    size: '32W x 32L',
    brand: 'Levi\'s',
    color: 'blue',
    material: 'denim'
  },
  {
    id: '2',
    name: 'Kaos Band Vintage',
    price: 375000,
    originalPrice: 600000,
    image: '/images/🇰🇷🇷🇸Korean-Serbian Couple Q&A： Marriage, How We Met & Life Together ｜ 한국 세르비아인 커플_frame_2-00.jpg',
    category: 'shirts',
    condition: 'Excellent',
    description: 'Kaos band vintage asli, lembut dan nyaman',
    size: 'L',
    brand: 'Hanes',
    color: 'black',
    material: 'cotton'
  },
  {
    id: '3',
    name: 'Blazer Wol',
    price: 825000,
    originalPrice: 2250000,
    image: '/images/🇰🇷🇷🇸Korean-Serbian Couple Q&A： Marriage, How We Met & Life Together ｜ 한국 세르비아인 커플_frame_2-30.jpg',
    category: 'jackets',
    condition: 'Good',
    description: 'Blazer wol profesional, cocok untuk keperluan kantor',
    size: 'M',
    brand: 'Brooks Brothers',
    color: 'navy',
    material: 'wool'
  },
  {
    id: '4',
    name: 'Dress Musim Panas Motif Bunga',
    price: 525000,
    originalPrice: 1200000,
    image: '/images/🇰🇷🇷🇸Korean-Serbian Couple Q&A： Marriage, How We Met & Life Together ｜ 한국 세르비아인 커플_frame_3-00.jpg',
    category: 'dresses',
    condition: 'Excellent',
    description: 'Dress cantik dengan motif bunga untuk musim panas, ringan dan mengalir',
    size: 'S',
    brand: 'Zara',
    color: 'floral',
    material: 'polyester'
  },
  {
    id: '5',
    name: 'Celana Chino Khaki',
    price: 420000,
    originalPrice: 975000,
    image: '/images/🇰🇷🇷🇸Korean-Serbian Couple Q&A： Marriage, How We Met & Life Together ｜ 한국 세르비아인 커플_frame_3-20.jpg',
    category: 'pants',
    condition: 'Good',
    description: 'Celana chino khaki yang nyaman, cocok untuk pakaian kasual',
    size: '34W x 30L',
    brand: 'Gap',
    color: 'khaki',
    material: 'cotton'
  },
  {
    id: '6',
    name: 'Sweater Oversized',
    price: 480000,
    originalPrice: 1125000,
    image: '/images/🇰🇷🇷🇸Korean-Serbian Couple Q&A： Marriage, How We Met & Life Together ｜ 한국 세르비아인 커플_frame_4-00.jpg',
    category: 'shirts',
    condition: 'Excellent',
    description: 'Sweater oversized yang hangat, sempurna untuk layering',
    size: 'M',
    brand: 'H&M',
    color: 'cream',
    material: 'acrylic'
  },
  {
    id: '7',
    name: 'Jaket Denim',
    price: 570000,
    originalPrice: 1425000,
    image: '/images/🇰🇷🇷🇸Korean-Serbian Couple Q&A： Marriage, How We Met & Life Together ｜ 한국 세르비아인 커플_frame_1-30.jpg',
    category: 'jackets',
    condition: 'Good',
    description: 'Jaket denim klasik, serbaguna dan timeless',
    size: 'M',
    brand: 'Levi\'s',
    color: 'blue',
    material: 'denim'
  },
  {
    id: '8',
    name: 'Celana Formal Hitam',
    price: 630000,
    originalPrice: 1275000,
    image: '/images/🇰🇷🇷🇸Korean-Serbian Couple Q&A： Marriage, How We Met & Life Together ｜ 한국 세르비아인 커플_frame_2-00.jpg',
    category: 'pants',
    condition: 'Excellent',
    description: 'Celana formal hitam profesional, potongan pas',
    size: '30W x 32L',
    brand: 'Banana Republic',
    color: 'black',
    material: 'wool blend'
  },
  {
    id: '9',
    name: 'Kaos Grafis Vintage',
    price: 330000,
    image: '/images/🇰🇷🇷🇸Korean-Serbian Couple Q&A： Marriage, How We Met & Life Together ｜ 한국 세르비아인 커플_frame_2-30.jpg',
    category: 'shirts',
    condition: 'Fair',
    description: 'Kaos grafis vintage keren dengan desain retro',
    size: 'XL',
    brand: 'Fruit of the Loom',
    color: 'white',
    material: 'cotton'
  },
  {
    id: '10',
    name: 'Dress Maxi',
    price: 720000,
    originalPrice: 1800000,
    image: '/images/🇰🇷🇷🇸Korean-Serbian Couple Q&A： Marriage, How We Met & Life Together ｜ 한국 세르비아인 커플_frame_3-00.jpg',
    category: 'dresses',
    condition: 'Good',
    description: 'Dress maxi elegan, sempurna untuk acara khusus',
    size: 'M',
    brand: 'Free People',
    color: 'burgundy',
    material: 'viscose'
  },
  {
    id: '11',
    name: 'Celana Korduroy',
    price: 525000,
    originalPrice: 1050000,
    image: '/images/🇰🇷🇷🇸Korean-Serbian Couple Q&A： Marriage, How We Met & Life Together ｜ 한국 세르비아인 커플_frame_3-20.jpg',
    category: 'pants',
    condition: 'Good',
    description: 'Celana korduroy retro, nyaman dan stylish',
    size: '32W x 30L',
    brand: 'Urban Outfitters',
    color: 'brown',
    material: 'corduroy'
  },
  {
    id: '12',
    name: 'Jaket Kulit',
    price: 1275000,
    originalPrice: 3000000,
    image: '/images/🇰🇷🇷🇸Korean-Serbian Couple Q&A： Marriage, How We Met & Life Together ｜ 한국 세르비아인 커플_frame_4-00.jpg',
    category: 'jackets',
    condition: 'Excellent',
    description: 'Jaket kulit asli, gaya timeless',
    size: 'L',
    brand: 'Wilson\'s Leather',
    color: 'black',
    material: 'leather'
  }
];

type SortOption = 'price-low' | 'price-high' | 'newest' | 'popular';

export default function App() {
  const [searchQuery, setSearchQuery] = useState('');
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [filters, setFilters] = useState<FilterOptions>({
    categories: [],
    conditions: [],
    priceRange: [0, 1500000],
    brands: [],
    sizes: [],
    colors: []
  });

  // Get unique values for filters
  const availableCategories = Array.from(new Set(mockProducts.map(p => p.category)));
  const availableBrands = Array.from(new Set(mockProducts.map(p => p.brand).filter((b): b is string => Boolean(b))));
  const availableSizes = Array.from(new Set(mockProducts.map(p => p.size).filter((s): s is string => Boolean(s))));
  const availableColors = Array.from(new Set(mockProducts.map(p => p.color).filter((c): c is string => Boolean(c))));
  const maxPrice = Math.max(...mockProducts.map(p => p.price));

  // Calculate active filters count
  const activeFiltersCount = filters.categories.length + 
    filters.conditions.length + 
    filters.brands.length + 
    filters.sizes.length + 
    filters.colors.length +
    (filters.priceRange[0] > 0 || filters.priceRange[1] < maxPrice ? 1 : 0);

  // Filter and sort products
  const filteredAndSortedProducts = useMemo(() => {
    let filtered = mockProducts.filter(product => {
      // Search filter
      if (searchQuery && !product.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
          !product.description.toLowerCase().includes(searchQuery.toLowerCase()) &&
          !product.brand?.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }

      // Category filter
      if (filters.categories.length > 0 && !filters.categories.includes(product.category)) {
        return false;
      }

      // Condition filter
      if (filters.conditions.length > 0 && !filters.conditions.includes(product.condition)) {
        return false;
      }

      // Price filter
      if (product.price < filters.priceRange[0] || product.price > filters.priceRange[1]) {
        return false;
      }

      // Brand filter
      if (filters.brands.length > 0 && !filters.brands.includes(product.brand || '')) {
        return false;
      }

      // Size filter
      if (filters.sizes.length > 0 && !filters.sizes.includes(product.size || '')) {
        return false;
      }

      // Color filter
      if (filters.colors.length > 0 && !filters.colors.includes(product.color || '')) {
        return false;
      }

      return true;
    });

    // Sort products
    switch (sortBy) {
      case 'price-low':
        filtered.sort((a, b) => a.price - b.price);
        break;
      case 'price-high':
        filtered.sort((a, b) => b.price - a.price);
        break;
      case 'newest':
        // Keep original order for "newest"
        break;
      case 'popular':
        // Random order for "popular"
        filtered.sort(() => Math.random() - 0.5);
        break;
    }

    return filtered;
  }, [searchQuery, filters, sortBy]);

  // Cart functions
  const addToCart = (product: Product) => {
    setCartItems(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        return prev.map(item =>
          item.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prev, { ...product, quantity: 1 }];
    });
  };

  const updateCartQuantity = (productId: string, quantity: number) => {
    if (quantity === 0) {
      removeFromCart(productId);
      return;
    }
    setCartItems(prev =>
      prev.map(item =>
        item.id === productId ? { ...item, quantity } : item
      )
    );
  };

  const removeFromCart = (productId: string) => {
    setCartItems(prev => prev.filter(item => item.id !== productId));
  };

  const toggleFavorite = (productId: string) => {
    setFavorites(prev => {
      const newFavorites = new Set(prev);
      if (newFavorites.has(productId)) {
        newFavorites.delete(productId);
      } else {
        newFavorites.add(productId);
      }
      return newFavorites;
    });
  };

  const cartItemCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div className="min-h-screen bg-white">
      <Header
        cartItemCount={cartItemCount}
        onCartClick={() => setIsCartOpen(true)}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />
      
      <HeroSection />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <div className="flex flex-col lg:flex-row gap-8 lg:gap-12">
          {/* Desktop Filters Sidebar */}
          <aside className="hidden lg:block w-64 shrink-0">
            <ProductFilters
              filters={filters}
              onFiltersChange={setFilters}
              availableCategories={availableCategories}
              availableBrands={availableBrands}
              availableSizes={availableSizes}
              availableColors={availableColors}
              maxPrice={maxPrice}
            />
          </aside>

          {/* Main Content */}
          <div className="flex-1">
            {/* Mobile Toolbar */}
            <div className="flex items-center gap-3 mb-6 lg:hidden">
              <MobileFilters
                filters={filters}
                onFiltersChange={setFilters}
                availableCategories={availableCategories}
                availableBrands={availableBrands}
                availableSizes={availableSizes}
                availableColors={availableColors}
                maxPrice={maxPrice}
                activeFiltersCount={activeFiltersCount}
              />
              <Select value={sortBy} onValueChange={(value: SortOption) => setSortBy(value)}>
                <SelectTrigger className="flex-1 bg-gray-50 border-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">신상품순</SelectItem>
                  <SelectItem value="popular">인기순</SelectItem>
                  <SelectItem value="price-low">낮은가격순</SelectItem>
                  <SelectItem value="price-high">높은가격순</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Desktop Toolbar */}
            <div className="hidden lg:flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-1">
                  {searchQuery ? `"${searchQuery}" 검색 결과` : '전체 상품'}
                </h2>
                <p className="text-sm text-gray-500">
                  총 {filteredAndSortedProducts.length}개
                </p>
              </div>
              
              <div className="flex items-center gap-3">
                <Select value={sortBy} onValueChange={(value: SortOption) => setSortBy(value)}>
                  <SelectTrigger className="w-40 h-9 bg-white border-gray-200 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="newest">신상품순</SelectItem>
                    <SelectItem value="popular">인기순</SelectItem>
                    <SelectItem value="price-low">낮은가격순</SelectItem>
                    <SelectItem value="price-high">높은가격순</SelectItem>
                  </SelectContent>
                </Select>
                
                <div className="flex border border-gray-200 rounded-md overflow-hidden">
                  <Button
                    variant={viewMode === 'grid' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setViewMode('grid')}
                    className="rounded-none border-0 h-9 px-3"
                  >
                    <Grid className="h-4 w-4" />
                  </Button>
                  <Button
                    variant={viewMode === 'list' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setViewMode('list')}
                    className="rounded-none border-0 h-9 px-3"
                  >
                    <List className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Results count for mobile */}
            <div className="mb-6 lg:hidden">
              <p className="text-sm text-gray-500">
                총 {filteredAndSortedProducts.length}개
              </p>
            </div>

            {/* Product Grid */}
            {filteredAndSortedProducts.length === 0 ? (
              <div className="text-center py-20">
                <p className="text-gray-500 text-base mb-4">검색 결과가 없습니다.</p>
                <Button
                  variant="outline"
                  onClick={() => {
                    setSearchQuery('');
                    setFilters({
                      categories: [],
                      conditions: [],
                      priceRange: [0, maxPrice],
                      brands: [],
                      sizes: [],
                      colors: []
                    });
                  }}
                  className="bg-white border-gray-200"
                >
                  필터 초기화
                </Button>
              </div>
            ) : (
              <div className={
                viewMode === 'grid' 
                  ? 'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-8'
                  : 'space-y-3 sm:space-y-4'
              }>
                {filteredAndSortedProducts.map(product => {
                  const cardProps = {
                    product,
                    onAddToCart: addToCart,
                    onToggleFavorite: toggleFavorite,
                    isFavorite: favorites.has(product.id),
                    isMobile: viewMode === 'list'
                  } as React.ComponentProps<typeof ProductCard>;
                  
                  return <ProductCard key={product.id} {...cardProps} />;
                })}
              </div>
            )}
          </div>
        </div>
      </main>

      <ShoppingCart
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        cartItems={cartItems}
        onUpdateQuantity={updateCartQuantity}
        onRemoveItem={removeFromCart}
      />
    </div>
  );
}