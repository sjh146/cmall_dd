import { useState, useMemo } from 'react';
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
    image: 'https://images.unsplash.com/photo-1542272604-787c3835535d?w=400&h=400&fit=crop',
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
    image: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=400&h=400&fit=crop',
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
    image: 'https://images.unsplash.com/photo-1594633312681-425c7b97ccd1?w=400&h=400&fit=crop',
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
    image: 'https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?w=400&h=400&fit=crop',
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
    image: 'https://images.unsplash.com/photo-1473966968600-fa801b869a1a?w=400&h=400&fit=crop',
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
    image: 'https://images.unsplash.com/photo-1434389677669-e08b4cac3105?w=400&h=400&fit=crop',
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
    image: 'https://images.unsplash.com/photo-1551537482-f2075a1d41f2?w=400&h=400&fit=crop',
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
    image: 'https://images.unsplash.com/photo-1594633312681-425c7b97ccd1?w=400&h=400&fit=crop',
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
    image: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=400&h=400&fit=crop',
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
    image: 'https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?w=400&h=400&fit=crop',
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
    image: 'https://images.unsplash.com/photo-1473966968600-fa801b869a1a?w=400&h=400&fit=crop',
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
    image: 'https://images.unsplash.com/photo-1551028719-00167b16eac5?w=400&h=400&fit=crop',
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
  const availableBrands = Array.from(new Set(mockProducts.map(p => p.brand).filter(Boolean)));
  const availableSizes = Array.from(new Set(mockProducts.map(p => p.size).filter(Boolean)));
  const availableColors = Array.from(new Set(mockProducts.map(p => p.color).filter(Boolean)));
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
    <div className="min-h-screen bg-gray-50">
      <Header
        cartItemCount={cartItemCount}
        onCartClick={() => setIsCartOpen(true)}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />
      
      <HeroSection />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
        <div className="flex flex-col lg:flex-row gap-6 lg:gap-8">
          {/* Desktop Filters Sidebar */}
          <aside className="hidden lg:block w-80 shrink-0">
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
            <div className="flex items-center gap-3 mb-4 lg:hidden">
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
                <SelectTrigger className="flex-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">Terbaru</SelectItem>
                  <SelectItem value="popular">Populer</SelectItem>
                  <SelectItem value="price-low">Harga ↑</SelectItem>
                  <SelectItem value="price-high">Harga ↓</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Desktop Toolbar */}
            <div className="hidden lg:flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">
                  {searchQuery ? `Hasil Pencarian untuk "${searchQuery}"` : 'Pakaian &amp; Celana Thrift'}
                </h2>
                <p className="text-gray-600">
                  {filteredAndSortedProducts.length} {filteredAndSortedProducts.length === 1 ? 'barang' : 'barang'} ditemukan
                </p>
              </div>
              
              <div className="flex items-center gap-4">
                <Select value={sortBy} onValueChange={(value: SortOption) => setSortBy(value)}>
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="newest">Terbaru</SelectItem>
                    <SelectItem value="popular">Paling Populer</SelectItem>
                    <SelectItem value="price-low">Harga: Rendah ke Tinggi</SelectItem>
                    <SelectItem value="price-high">Harga: Tinggi ke Rendah</SelectItem>
                  </SelectContent>
                </Select>
                
                <div className="flex border rounded-md">
                  <Button
                    variant={viewMode === 'grid' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setViewMode('grid')}
                    className="rounded-r-none"
                  >
                    <Grid className="h-4 w-4" />
                  </Button>
                  <Button
                    variant={viewMode === 'list' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setViewMode('list')}
                    className="rounded-l-none"
                  >
                    <List className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Results count for mobile */}
            <div className="mb-4 lg:hidden">
              <p className="text-gray-600 text-sm">
                {filteredAndSortedProducts.length} {filteredAndSortedProducts.length === 1 ? 'barang' : 'barang'} ditemukan
              </p>
            </div>

            {/* Product Grid */}
            {filteredAndSortedProducts.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-500 text-lg mb-4">Tidak ada pakaian yang ditemukan sesuai kriteria Anda.</p>
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
                >
                  Hapus Semua Filter
                </Button>
              </div>
            ) : (
              <div className={
                viewMode === 'grid' 
                  ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6'
                  : 'space-y-3 sm:space-y-4'
              }>
                {filteredAndSortedProducts.map(product => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    onAddToCart={addToCart}
                    onToggleFavorite={toggleFavorite}
                    isFavorite={favorites.has(product.id)}
                    isMobile={viewMode === 'list'}
                  />
                ))}
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