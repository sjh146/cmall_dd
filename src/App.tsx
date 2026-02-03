import React, { useState, useMemo, useEffect } from 'react';
import { Header } from './components/Header';
import { HeroSection } from './components/HeroSection';
import { ProductCard, Product } from './components/ProductCard';
import { ShoppingCart, CartItem } from './components/ShoppingCart';
import { ProductFilters, FilterOptions } from './components/ProductFilters';
import { MobileFilters } from './components/MobileFilters';
import { Button } from './components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './components/ui/select';
import { Grid, List } from 'lucide-react';
import { fetchProducts, addToCart as addToCartAPI, fetchCart, updateCartItem as updateCartItemAPI, removeFromCart as removeFromCartAPI, type Product as APIProduct, type CartItem as APICartItem } from './lib/api';

// Convert API Product to Component Product
function convertAPIProductToProduct(apiProduct: APIProduct): Product {
  return {
    id: String(apiProduct.id),
    name: apiProduct.name,
    price: apiProduct.price,
    originalPrice: apiProduct.originalPrice,
    image: apiProduct.image,
    category: apiProduct.category,
    condition: apiProduct.condition as 'Excellent' | 'Good' | 'Fair',
    description: apiProduct.description,
    size: apiProduct.size,
    brand: apiProduct.brand,
    color: apiProduct.color,
    material: apiProduct.material,
  };
}

// Convert API CartItem to Component CartItem
function convertAPICartItemToCartItem(apiCartItem: APICartItem): CartItem {
  if (!apiCartItem.product) {
    throw new Error('Cart item must have a product');
  }
  const product = convertAPIProductToProduct(apiCartItem.product);
  return {
    ...product,
    quantity: apiCartItem.quantity,
  };
}

type SortOption = 'price-low' | 'price-high' | 'newest' | 'popular';

export default function App() {
  const [searchQuery, setSearchQuery] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<FilterOptions>({
    categories: [],
    conditions: [],
    priceRange: [0, 1500000],
    brands: [],
    sizes: [],
    colors: []
  });

  // Load products from API
  useEffect(() => {
    const loadProducts = async () => {
      try {
        setLoading(true);
        setError(null);
        const apiProducts = await fetchProducts();
        const convertedProducts = apiProducts.map(convertAPIProductToProduct);
        setProducts(convertedProducts);
        
        // Update price range filter based on actual products
        if (convertedProducts.length > 0) {
          const maxPrice = Math.max(...convertedProducts.map(p => p.price));
          setFilters(prev => ({
            ...prev,
            priceRange: [0, maxPrice]
          }));
        }
      } catch (err) {
        console.error('Failed to load products:', err);
        setError('제품을 불러오는데 실패했습니다. 잠시 후 다시 시도해주세요.');
      } finally {
        setLoading(false);
      }
    };

    loadProducts();
  }, []);

  // Load cart from API
  useEffect(() => {
    const loadCart = async () => {
      try {
        const apiCartItems = await fetchCart();
        const convertedCartItems = apiCartItems.map(convertAPICartItemToCartItem);
        setCartItems(convertedCartItems);
      } catch (err) {
        console.error('Failed to load cart:', err);
        // Cart will be empty if API fails
      }
    };

    loadCart();
  }, []);

  // Get unique values for filters
  const availableCategories: string[] = Array.from(new Set(products.map(p => p.category)));
  const availableBrands: string[] = Array.from(new Set(products.map(p => p.brand).filter((b): b is string => Boolean(b))));
  const availableSizes: string[] = Array.from(new Set(products.map(p => p.size).filter((s): s is string => Boolean(s))));
  const availableColors: string[] = Array.from(new Set(products.map(p => p.color).filter((c): c is string => Boolean(c))));
  const maxPrice = products.length > 0 ? Math.max(...products.map(p => p.price)) : 1500000;

  // Calculate active filters count
  const activeFiltersCount = filters.categories.length + 
    filters.conditions.length + 
    filters.brands.length + 
    filters.sizes.length + 
    filters.colors.length +
    (filters.priceRange[0] > 0 || filters.priceRange[1] < maxPrice ? 1 : 0);

  // Filter and sort products
  const filteredAndSortedProducts = useMemo(() => {
    let filtered = products.filter(product => {
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
  }, [products, searchQuery, filters, sortBy]);

  // Cart functions
  const addToCart = async (product: Product) => {
    try {
      const productId = parseInt(product.id);
      await addToCartAPI(productId, 1);
      
      // Reload cart from API
      const apiCartItems = await fetchCart();
      const convertedCartItems = apiCartItems.map(convertAPICartItemToCartItem);
      setCartItems(convertedCartItems);
      } catch (err) {
        console.error('Failed to add to cart:', err);
      }
  };

  const updateCartQuantity = async (productId: string, quantity: number) => {
    try {
      if (quantity === 0) {
        await removeFromCart(productId);
        return;
      }

      // Find the API cart item ID
      const apiCartItems = await fetchCart();
      const apiCartItem = apiCartItems.find(item => String(item.productId) === productId);
      
      if (!apiCartItem) {
        throw new Error('Cart item not found');
      }

      await updateCartItemAPI(apiCartItem.id, quantity);
      
      // Reload cart from API
      const updatedCartItems = await fetchCart();
      const convertedCartItems = updatedCartItems.map(convertAPICartItemToCartItem);
      setCartItems(convertedCartItems);
    } catch (err) {
      console.error('Failed to update cart:', err);
    }
  };

  const removeFromCart = async (productId: string) => {
    try {
      const cartItem = cartItems.find(item => item.id === productId);
      if (!cartItem) return;

      // Find the cart item ID from API (we need to track this)
      // For now, we'll use a workaround
      const apiCartItems = await fetchCart();
      const apiCartItem = apiCartItems.find(item => String(item.productId) === productId);
      
      if (apiCartItem) {
        await removeFromCartAPI(apiCartItem.id);
      }
      
      // Reload cart from API
      const updatedCartItems = await fetchCart();
      const convertedCartItems = updatedCartItems.map(convertAPICartItemToCartItem);
      setCartItems(convertedCartItems);
    } catch (err) {
      console.error('Failed to remove from cart:', err);
    }
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

            {/* Loading State */}
            {loading && (
              <div className="text-center py-20">
                <p className="text-gray-500 text-base">제품을 불러오는 중...</p>
              </div>
            )}

            {/* Error State */}
            {error && !loading && (
              <div className="text-center py-20">
                <p className="text-red-500 text-base mb-4">{error}</p>
                <Button
                  variant="outline"
                  onClick={async () => {
                    try {
                      setLoading(true);
                      setError(null);
                      const apiProducts = await fetchProducts();
                      const convertedProducts = apiProducts.map(convertAPIProductToProduct);
                      setProducts(convertedProducts);
                    } catch (err) {
                      setError('제품을 불러오는데 실패했습니다.');
                    } finally {
                      setLoading(false);
                    }
                  }}
                  className="bg-white border-gray-200"
                >
                  다시 시도
                </Button>
              </div>
            )}

            {/* Product Grid */}
            {!loading && !error && filteredAndSortedProducts.length === 0 ? (
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
            ) : !loading && !error ? (
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
            ) : null}
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