import React, { useState, useMemo, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { CartProvider } from './contexts/CartContext';
import { Header } from './components/Header';
import { HeroSection } from './components/HeroSection';
import { ProductCard, Product } from './components/ProductCard';
import { ShoppingCart, CartItem } from './components/ShoppingCart';
import { ProductFilters, FilterOptions } from './components/ProductFilters';
import { MobileFilters } from './components/MobileFilters';
import AuthPage from './pages/AuthPage';
import SellerDashboard from './pages/SellerDashboard';
import DiaryPage from './pages/DiaryPage';
import MyProducts from './pages/MyProducts';
import AdminPage from './pages/AdminPage';
import LecturePage from './pages/LecturePage';
import NoticePage from './pages/NoticePage';
import { CommunityPage } from './pages/CommunityPage';
import ProductPage from './pages/ProductPage';
import { Button } from './components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './components/ui/select';
import { Grid, List } from 'lucide-react';
import { fetchProducts, addToCart as addToCartAPI, fetchCart, updateCartItem as updateCartItemAPI, removeFromCart as removeFromCartAPI, type Product as APIProduct, type CartItem as APICartItem } from './lib/api';
import { useAuth } from './contexts/AuthContext';

// Convert API Product to Component Product
function convertAPIProductToProduct(apiProduct: APIProduct): Product {
  return {
    id: String(apiProduct.id),
    name: apiProduct.name,
    price: apiProduct.price,
    originalPrice: apiProduct.originalPrice,
    image: apiProduct.image,
    category: apiProduct.category,
    condition: apiProduct.productType as 'Excellent' | 'Good' | 'Fair',
    description: apiProduct.description,
    size: apiProduct.version,
    brand: '',
    color: '',
    material: '',
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

function HomePage() {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [filters, setFilters] = useState<FilterOptions>({
    categories: [],
    conditions: [],
    priceRange: [0, 1000000],
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
        
        if (convertedProducts.length > 0) {
          const maxPrice = Math.max(...convertedProducts.map(p => p.price));
          setFilters(prev => ({
            ...prev,
            priceRange: [0, maxPrice]
          }));
        }
      } catch (err) {
        console.error('Failed to load products:', err);
        setError('Failed to load products. Please try again.');
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
        if (apiCartItems && Array.isArray(apiCartItems)) {
          const convertedCartItems = apiCartItems.map(convertAPICartItemToCartItem);
          setCartItems(convertedCartItems);
        }
      } catch (err) {
        console.error('Failed to load cart:', err);
      }
    };

    loadCart();
  }, []);

  // Get unique values for filters
  const availableCategories: string[] = Array.from(new Set(products.map(p => p.category)));
  const maxPrice = products.length > 0 ? Math.max(...products.map(p => p.price)) : 1000000;

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
          !product.description.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }

      // Category filter
      if (selectedCategory && selectedCategory !== 'all') {
        if (product.category !== selectedCategory) {
          return false;
        }
      } else if (filters.categories.length > 0 && !filters.categories.includes(product.category)) {
        return false;
      }

      // Price filter
      if (product.price < filters.priceRange[0] || product.price > filters.priceRange[1]) {
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
        break;
      case 'popular':
        filtered.sort(() => Math.random() - 0.5);
        break;
    }

    return filtered;
  }, [products, searchQuery, filters, sortBy, selectedCategory]);

  // Cart functions
  const addToCart = async (product: Product) => {
    try {
      const productId = parseInt(product.id);
      await addToCartAPI(productId, 1);
      
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

      const apiCartItems = await fetchCart();
      const apiCartItem = apiCartItems.find(item => String(item.productId) === productId);
      
      if (!apiCartItem) {
        throw new Error('Cart item not found');
      }

      await updateCartItemAPI(apiCartItem.id, quantity);
      
      const updatedCartItems = await fetchCart();
      const convertedCartItems = updatedCartItems.map(convertAPICartItemToCartItem);
      setCartItems(convertedCartItems);
    } catch (err) {
      console.error('Failed to update cart:', err);
    }
  };

  const removeFromCart = async (productId: string) => {
    try {
      const apiCartItems = await fetchCart();
      const apiCartItem = apiCartItems.find(item => String(item.productId) === productId);
      
      if (apiCartItem) {
        await removeFromCartAPI(apiCartItem.id);
      }
      
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
    <>
      <Header
        onCartClick={() => setIsCartOpen(true)}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        selectedCategory={selectedCategory}
        onCategoryChange={(category) => {
          setSelectedCategory(category === '' ? 'all' : category);
          setFilters(prev => ({ ...prev, categories: [] }));
        }}
      />
      
      <HeroSection />

      {user ? (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
          <div className="bg-[#f5efe0] border border-[#e0d5b8] rounded-lg px-6 py-5">
            <h2 className="text-base font-semibold text-[#111111]">모델이 뭘 보고 배우나요</h2>
            <p className="text-sm text-[#4b5563] mt-2 leading-relaxed">
              여기서 파는 리포트는 전부 같은 엔진에서 나옵니다. 시장이 닫히면 KOSPI·KOSDAQ
              전 종목의 시세(가격, 거래량, 모멘텀, 변동성)를 모으고, 여기에 재무제표에서 뽑은
              PER·PBR·ROE 같은 지표와 뉴스 흐름(기사 감성, 이벤트, 테마 노출)까지 합쳐 173개
              지표로 정리합니다. 서로 다른 알고리즘 3개(XGBoost·LightGBM·CatBoost)가 각자
              예측한 뒤 투표해 결론을 내리고, 학습은 최근 두 달치 데이터로 7주에 두 번(약 3주
              반 간격) 새로 돌려서 시장 흐름을 계속 따라잡습니다.
            </p>
          </div>
        </section>
      ) : null}

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <div className="flex flex-col lg:flex-row gap-8 lg:gap-12">
          {/* Desktop Filters Sidebar */}
          <aside className="hidden lg:block w-64 shrink-0">
            <ProductFilters
              filters={filters}
              onFiltersChange={setFilters}
              availableCategories={availableCategories}
              availableBrands={[]}
              availableSizes={[]}
              availableColors={[]}
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
                availableBrands={[]}
                availableSizes={[]}
                availableColors={[]}
                maxPrice={maxPrice}
                activeFiltersCount={activeFiltersCount}
              />
              <Select value={sortBy} onValueChange={(value: SortOption) => setSortBy(value)}>
                <SelectTrigger className="flex-1 bg-secondary border-border text-foreground">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">Newest</SelectItem>
                  <SelectItem value="popular">Popular</SelectItem>
                  <SelectItem value="price-low">Price: Low to High</SelectItem>
                  <SelectItem value="price-high">Price: High to Low</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Desktop Toolbar */}
            <div id="products" className="hidden lg:flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
              <div>
                <h2 className="font-display text-[1.35rem] font-semibold text-foreground mb-1">
                  {searchQuery ? `Search results for "${searchQuery}"` : '분석 서비스'}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {filteredAndSortedProducts.length}개 상품
                </p>
              </div>
              
              <div className="flex items-center gap-3">
                <Select value={sortBy} onValueChange={(value: SortOption) => setSortBy(value)}>
                  <SelectTrigger className="w-40 h-9 bg-card border-border text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="newest">Newest</SelectItem>
                    <SelectItem value="popular">Popular</SelectItem>
                    <SelectItem value="price-low">Price: Low to High</SelectItem>
                    <SelectItem value="price-high">Price: High to Low</SelectItem>
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
                {filteredAndSortedProducts.length} products
              </p>
            </div>

            {/* Loading State */}
            {loading && (
              <div className="text-center py-20">
                <p className="text-gray-500 text-base">Loading products...</p>
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
                      setError('Failed to load products.');
                    } finally {
                      setLoading(false);
                    }
                  }}
                  className="bg-secondary border-border"
                >
                  Try Again
                </Button>
              </div>
            )}

            {/* Product Grid */}
            {!loading && !error && filteredAndSortedProducts.length === 0 ? (
              <div className="text-center py-20">
                <p className="text-muted-foreground text-base mb-4">No products found.</p>
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
                  className="bg-secondary border-border"
                >
                  Clear Filters
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
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <CartProvider>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/auth" element={<AuthPage />} />
          <Route path="/seller" element={<SellerDashboard />} />
          <Route path="/diary" element={<DiaryPage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/lectures" element={<LecturePage />} />
          <Route path="/community" element={<CommunityPage />} />
          <Route path="/notices" element={<NoticePage />} />
          <Route path="/my-products" element={<MyProducts />} />
          <Route path="/product/:id" element={<ProductPage />} />
          {/* M6 통합: AI 분석 결제는 FQT 쇼핑몰 상품 상세(/product/:id)에 통합 — /agents는 메인으로 */}
          <Route path="/agents" element={<Navigate to="/" replace />} />
        </Routes>
      </CartProvider>
    </BrowserRouter>
  );
}
