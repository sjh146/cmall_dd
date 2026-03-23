import { Search, ShoppingCart, Menu, User, LogOut, Package, Plus } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from './ui/sheet';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

interface HeaderProps {
  cartItemCount: number;
  onCartClick: () => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  selectedCategory?: string;
  onCategoryChange?: (category: string) => void;
}

const categoryMap: Record<string, string> = {
  'all': '',
  'software': 'software',
  'ebook': 'ebook',
};

const categories = [
  { key: 'all', label: 'All Products', icon: '📦' },
  { key: 'software', label: 'Software', icon: '💻' },
  { key: 'ebook', label: 'E-Books', icon: '📚' },
];

export function Header({ cartItemCount, onCartClick, searchQuery, onSearchChange, selectedCategory = 'all', onCategoryChange }: HeaderProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleCategoryClick = (categoryKey: string) => {
    if (onCategoryChange) {
      onCategoryChange(categoryMap[categoryKey]);
    }
    setIsMenuOpen(false);
  };

  const handleLogout = () => {
    logout();
    setIsUserMenuOpen(false);
    navigate('/');
  };

  return (
    <>
      <header className="bg-background border-b border-border sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Mobile Menu Button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsMenuOpen(true)}
              className="md:hidden p-2 hover:bg-secondary"
            >
              <Menu className="h-5 w-5 text-foreground" />
            </Button>

            <Link to="/">
              <h1 className="text-4xl md:text-5xl font-bold tracking-wider" style={{ fontFamily: 'Permanent Marker, cursive' }}>
                DevMall
              </h1>
            </Link>

            {/* Desktop Navigation - Hidden on mobile */}
            <nav className="hidden md:flex space-x-6 flex-1 justify-center">
              {categories.map((cat) => (
                <button
                  key={cat.key}
                  onClick={() => handleCategoryClick(cat.key)}
                  className={`text-sm font-bold uppercase tracking-wider transition-all flex items-center gap-1 ${
                    selectedCategory === cat.key || (cat.key === 'all' && selectedCategory === '')
                      ? 'text-primary'
                      : 'text-gray-400 hover:text-primary'
                  }`}
                >
                  <span>{cat.icon}</span>
                  {cat.label}
                </button>
              ))}
            </nav>

            {/* Desktop Search - Hidden on mobile */}
            <div className="hidden md:flex flex-1 max-w-md mx-8">
              <div className="relative w-full">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  type="search"
                  placeholder="Search products..."
                  value={searchQuery}
                  onChange={(e) => onSearchChange(e.target.value)}
                  className="pl-11 h-10 bg-secondary border-0 rounded-md focus:bg-secondary focus:ring-1 focus:ring-primary text-foreground placeholder:text-muted-foreground"
                />
              </div>
            </div>

            {/* Desktop Actions */}
            <div className="hidden md:flex items-center space-x-2">
              {user ? (
                <>
                  <Link to="/seller">
                    <Button variant="ghost" size="sm" className="gap-2">
                      <Plus className="h-4 w-4" />
                      Sell
                    </Button>
                  </Link>
                  <div className="relative">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                      className="gap-2"
                    >
                      <User className="h-4 w-4" />
                      {user.name}
                    </Button>
                    {isUserMenuOpen && (
                      <div className="absolute right-0 mt-2 w-48 bg-background border border-border rounded-md shadow-lg py-1">
                        <Link
                          to="/my-products"
                          className="block px-4 py-2 text-sm hover:bg-secondary"
                          onClick={() => setIsUserMenuOpen(false)}
                        >
                          <Package className="h-4 w-4 inline mr-2" />
                          My Products
                        </Link>
                        <button
                          onClick={handleLogout}
                          className="w-full text-left px-4 py-2 text-sm hover:bg-secondary text-destructive"
                        >
                          <LogOut className="h-4 w-4 inline mr-2" />
                          Sign Out
                        </button>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <Link to="/auth">
                  <Button variant="default" size="sm">
                    Sign In
                  </Button>
                </Link>
              )}
              
              <Button
                variant="ghost"
                size="sm"
                onClick={onCartClick}
                className="relative p-2 hover:bg-secondary"
              >
                <ShoppingCart className="h-5 w-5 text-foreground" />
                {cartItemCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 bg-primary text-primary-foreground text-[10px] rounded-full h-4 w-4 flex items-center justify-center font-bold">
                    {cartItemCount}
                  </span>
                )}
              </Button>
            </div>

            {/* Mobile Search and Cart */}
            <div className="flex items-center space-x-1 md:hidden">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsSearchOpen(!isSearchOpen)}
                className="p-2 hover:bg-secondary"
              >
                <Search className="h-5 w-5 text-foreground" />
              </Button>
              
              {user ? (
                <Link to="/my-products">
                  <Button variant="ghost" size="sm" className="p-2">
                    <Package className="h-5 w-5" />
                  </Button>
                </Link>
              ) : (
                <Link to="/auth">
                  <Button variant="ghost" size="sm" className="p-2">
                    <User className="h-5 w-5" />
                  </Button>
                </Link>
              )}
              
              <Button
                variant="ghost"
                size="sm"
                onClick={onCartClick}
                className="relative p-2 hover:bg-secondary"
              >
                <ShoppingCart className="h-5 w-5 text-foreground" />
                {cartItemCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 bg-primary text-primary-foreground text-[10px] rounded-full h-4 w-4 flex items-center justify-center font-bold">
                    {cartItemCount}
                  </span>
                )}
              </Button>
            </div>
          </div>

          {/* Mobile Search Bar */}
          {isSearchOpen && (
            <div className="md:hidden pb-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  type="search"
                  placeholder="Search products..."
                  value={searchQuery}
                  onChange={(e) => onSearchChange(e.target.value)}
                  className="pl-10 h-10 bg-secondary border-0 rounded-md text-foreground placeholder:text-muted-foreground"
                  autoFocus
                />
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Mobile Navigation Sheet */}
      <Sheet open={isMenuOpen} onOpenChange={setIsMenuOpen}>
        <SheetContent side="left" className="w-80 bg-background">
          <SheetHeader>
            <SheetTitle className="text-left">
              <Link to="/" onClick={() => setIsMenuOpen(false)}>
                <span className="text-4xl font-bold" style={{ fontFamily: 'Permanent Marker, cursive' }}>
                  DevMall
                </span>
              </Link>
              <span className="text-sm text-muted-foreground block mt-1">Software & E-Books Marketplace</span>
            </SheetTitle>
          </SheetHeader>
          
          <nav className="mt-8 space-y-2">
            {categories.map((cat) => (
              <button
                key={cat.key}
                onClick={() => handleCategoryClick(cat.key)}
                className={`w-full text-left flex items-center gap-3 py-3 px-2 text-base font-bold uppercase tracking-wider rounded-md transition-all ${
                  selectedCategory === cat.key || (cat.key === 'all' && selectedCategory === '')
                    ? 'text-primary bg-secondary'
                    : 'text-gray-400 hover:text-primary hover:bg-secondary'
                }`}
              >
                <span>{cat.icon}</span>
                {cat.label}
              </button>
            ))}

            <div className="border-t border-border my-4 pt-4">
              {user ? (
                <>
                  <Link
                    to="/seller"
                    onClick={() => setIsMenuOpen(false)}
                    className="flex items-center gap-3 py-3 px-2 text-base font-bold uppercase tracking-wider rounded-md text-gray-400 hover:text-primary hover:bg-secondary"
                  >
                    <Plus className="h-4 w-4" />
                    Sell Product
                  </Link>
                  <Link
                    to="/my-products"
                    onClick={() => setIsMenuOpen(false)}
                    className="flex items-center gap-3 py-3 px-2 text-base font-bold uppercase tracking-wider rounded-md text-gray-400 hover:text-primary hover:bg-secondary"
                  >
                    <Package className="h-4 w-4" />
                    My Products
                  </Link>
                  <button
                    onClick={() => { handleLogout(); setIsMenuOpen(false); }}
                    className="w-full flex items-center gap-3 py-3 px-2 text-base font-bold uppercase tracking-wider rounded-md text-destructive hover:bg-secondary"
                  >
                    <LogOut className="h-4 w-4" />
                    Sign Out
                  </button>
                </>
              ) : (
                <Link
                  to="/auth"
                  onClick={() => setIsMenuOpen(false)}
                  className="block text-center py-3 px-2 text-base font-bold uppercase tracking-wider rounded-md bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  Sign In / Register
                </Link>
              )}
            </div>
          </nav>
        </SheetContent>
      </Sheet>
    </>
  );
}
