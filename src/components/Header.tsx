import { Search, ShoppingCart, Menu, User, LogOut, Package, Plus, GraduationCap, Bell, BookOpen, Settings, X } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useCart } from '../contexts/CartContext';

interface HeaderProps {
  onCartClick: () => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  selectedCategory?: string;
  onCategoryChange?: (category: string) => void;
}

const categories = [
  { key: 'diary', label: 'Diary', route: '/diary' },
];

const navItems = [
  { key: 'lectures', label: 'Lectures', route: '/lectures', icon: GraduationCap },
  { key: 'notices', label: 'Notices', route: '/notices', icon: Bell },
  { key: 'diary', label: 'Diary', route: '/diary', icon: BookOpen },
];

export function Header({ onCartClick, searchQuery, onSearchChange, selectedCategory = 'diary', onCategoryChange }: HeaderProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  
  const { user, logout } = useAuth();
  const { cartCount } = useCart();
  const navigate = useNavigate();

  const handleCategoryClick = (category: typeof categories[0]) => {
    if (category.route) {
      navigate(category.route);
    } else if (onCategoryChange) {
      onCategoryChange(category.key);
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
      <header className="bg-[#0a0a0a] border-b border-[#262626] sticky top-0 z-50 backdrop-blur-sm bg-opacity-95">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Mobile Menu Button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsMenuOpen(true)}
              className="md:hidden p-2 hover:bg-[#1f1f1f] text-[#fafafa]"
            >
              <Menu className="h-5 w-5" />
            </Button>

            <Link to="/" className="flex flex-col items-center">
              <h1 
                className="text-3xl md:text-4xl font-black tracking-wider"
                style={{ fontFamily: 'Inter, sans-serif' }}
              >
                <span className="text-[#fafafa]">F</span>
                <span className="text-[#d4af37]">Q</span>
                <span className="text-[#fafafa]">T</span>
              </h1>
              <span className="text-[10px] text-[#d4af37] tracking-[0.2em] uppercase -mt-1">for quant trader</span>
            </Link>

            {/* Desktop Navigation - Hidden on mobile */}
            <nav className="hidden md:flex space-x-6 flex-1 justify-center items-center">
              {categories.map((cat) => (
                <button
                  key={cat.key}
                  onClick={() => handleCategoryClick(cat)}
                  className={`text-sm font-semibold uppercase tracking-widest transition-all relative ${
                    selectedCategory === cat.key
                      ? 'text-[#d4af37]'
                      : 'text-[#737373] hover:text-[#d4af37]'
                  } after:content-[''] after:absolute after:bottom-[-4px] after:left-0 after:w-full after:h-[2px] after:bg-[#d4af37] after:scale-x-0 after:transition-transform ${
                    selectedCategory === cat.key ? 'after:scale-x-100' : 'hover:after:scale-x-100'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
              <div className="w-px h-4 bg-[#262626] mx-2"></div>
              {navItems.slice(0, 2).map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.key}
                    to={item.route}
                    className="text-sm font-semibold uppercase tracking-widest text-[#737373] hover:text-[#d4af37] transition-colors flex items-center gap-1.5"
                  >
                    <Icon className="w-4 h-4" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            {/* Desktop Search - Hidden on mobile */}
            <div className="hidden md:flex flex-1 max-w-md mx-8">
              <div className="relative w-full">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-[#737373] h-4 w-4" />
                <Input
                  type="search"
                  placeholder="Search products..."
                  value={searchQuery}
                  onChange={(e) => onSearchChange(e.target.value)}
                  className="pl-11 h-10 bg-[#141414] border border-[#262626] rounded-lg focus:border-[#d4af37] focus:ring-1 focus:ring-[#d4af37] text-[#fafafa] placeholder:text-[#737373]"
                />
              </div>
            </div>

            {/* Desktop Actions */}
            <div className="hidden md:flex items-center space-x-3">
              {user ? (
                <>
                  <Link to="/seller">
                    <Button variant="ghost" size="sm" className="gap-2 text-[#fafafa] hover:text-[#d4af37] hover:bg-[#1f1f1f]">
                      <Plus className="h-4 w-4" />
                      Sell
                    </Button>
                  </Link>
                  {user.role === 'admin' && (
                    <Link to="/admin">
                      <Button variant="ghost" size="sm" className="gap-2 text-[#fafafa] hover:text-[#d4af37] hover:bg-[#1f1f1f]">
                        <Settings className="h-4 w-4" />
                        Admin
                      </Button>
                    </Link>
                  )}
                  <div className="relative">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                      className="gap-2 text-[#fafafa] hover:text-[#d4af37]"
                    >
                      <User className="h-4 w-4" />
                      {user.name}
                    </Button>
                    {isUserMenuOpen && (
                      <div className="absolute right-0 mt-2 w-56 bg-[#141414] border border-[#262626] rounded-lg shadow-xl py-1 z-50">
                        {user.role === 'admin' && (
                          <Link
                            to="/admin"
                            className="block px-4 py-2 text-sm text-[#d4af37] hover:bg-[#1f1f1f] border-b border-[#262626]"
                            onClick={() => setIsUserMenuOpen(false)}
                          >
                            <Settings className="h-4 w-4 inline mr-2" />
                            Admin Dashboard
                          </Link>
                        )}
                        <Link
                          to="/my-products"
                          className="block px-4 py-2 text-sm text-[#fafafa] hover:bg-[#1f1f1f] hover:text-[#d4af37]"
                          onClick={() => setIsUserMenuOpen(false)}
                        >
                          <Package className="h-4 w-4 inline mr-2" />
                          My Products
                        </Link>
                        <button
                          onClick={handleLogout}
                          className="w-full text-left px-4 py-2 text-sm text-[#dc2626] hover:bg-[#1f1f1f]"
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
                  <Button size="sm" className="bg-[#d4af37] text-[#0a0a0a] hover:bg-[#c9a432] font-semibold">
                    Sign In
                  </Button>
                </Link>
              )}
              
              <Button
                variant="ghost"
                size="sm"
                onClick={onCartClick}
                className="relative p-2 hover:bg-[#1f1f1f] text-[#fafafa]"
              >
                <ShoppingCart className="h-5 w-5" />
                {cartCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-[#d4af37] text-[#0a0a0a] text-[10px] rounded-full h-5 w-5 flex items-center justify-center font-bold">
                    {cartCount}
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
                className="p-2 hover:bg-[#1f1f1f] text-[#fafafa]"
              >
                <Search className="h-5 w-5" />
              </Button>
              
              {user ? (
                <Link to="/my-products">
                  <Button variant="ghost" size="sm" className="p-2 text-[#fafafa]">
                    <Package className="h-5 w-5" />
                  </Button>
                </Link>
              ) : (
                <Link to="/auth">
                  <Button variant="ghost" size="sm" className="p-2 text-[#fafafa]">
                    <User className="h-5 w-5" />
                  </Button>
                </Link>
              )}
              
              <Button
                variant="ghost"
                size="sm"
                onClick={onCartClick}
                className="relative p-2 hover:bg-[#1f1f1f] text-[#fafafa]"
              >
                <ShoppingCart className="h-5 w-5" />
                {cartCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-[#d4af37] text-[#0a0a0a] text-[10px] rounded-full h-5 w-5 flex items-center justify-center font-bold">
                    {cartCount}
                  </span>
                )}
              </Button>
            </div>
          </div>

          {/* Mobile Search Bar */}
          {isSearchOpen && (
            <div className="md:hidden pb-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[#737373] h-4 w-4" />
                <Input
                  type="search"
                  placeholder="Search products..."
                  value={searchQuery}
                  onChange={(e) => onSearchChange(e.target.value)}
                  className="pl-10 h-10 bg-[#141414] border border-[#262626] rounded-lg text-[#fafafa] placeholder:text-[#737373]"
                  autoFocus
                />
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Mobile Navigation Drawer */}
      {isMenuOpen && (
        <>
          <div className="fixed inset-0 bg-black/60 z-50" onClick={() => setIsMenuOpen(false)} />
          <div className="fixed left-0 top-0 bottom-0 w-80 bg-[#0a0a0a] border-r border-[#262626] z-50 overflow-y-auto">
            <div className="p-4 border-b border-[#262626]">
              <Link to="/" onClick={() => setIsMenuOpen(false)} className="flex flex-col items-start">
                <h1 className="text-4xl font-black tracking-wider">
                  <span className="text-[#fafafa]">F</span>
                  <span className="text-[#d4af37]">Q</span>
                  <span className="text-[#fafafa]">T</span>
                </h1>
                <span className="text-[10px] text-[#d4af37] tracking-[0.2em] uppercase">for quant trader</span>
              </Link>
            </div>
            
            <nav className="mt-4 space-y-1 p-2">
              {categories.map((cat) => (
                <button
                  key={cat.key}
                  onClick={() => handleCategoryClick(cat)}
                  className={`w-full text-left flex items-center justify-between py-3 px-4 text-sm font-semibold uppercase tracking-wider rounded-lg transition-all ${
                    selectedCategory === cat.key
                      ? 'text-[#d4af37] bg-[#1f1f1f]'
                      : 'text-[#737373] hover:text-[#d4af37] hover:bg-[#141414]'
                  }`}
                >
                  {cat.label}
                  <span className="text-xs opacity-50">→</span>
                </button>
              ))}

              {/* Additional nav items */}
              {navItems.slice(0, 2).map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.key}
                    to={item.route}
                    onClick={() => setIsMenuOpen(false)}
                    className="w-full flex items-center gap-3 py-3 px-4 text-sm font-semibold uppercase tracking-wider rounded-lg text-[#737373] hover:text-[#d4af37] hover:bg-[#141414]"
                  >
                    <Icon className="w-4 h-4" />
                    {item.label}
                  </Link>
                );
              })}

              <div className="border-t border-[#262626] my-4 pt-4">
                {user ? (
                  <>
                    <Link
                      to="/seller"
                      onClick={() => setIsMenuOpen(false)}
                      className="flex items-center justify-between py-3 px-4 text-sm font-semibold uppercase tracking-wider rounded-lg text-[#737373] hover:text-[#d4af37] hover:bg-[#141414]"
                    >
                      <Plus className="h-4 w-4" />
                      Sell Product
                    </Link>
                    {user.role === 'admin' && (
                      <Link
                        to="/admin"
                        onClick={() => setIsMenuOpen(false)}
                        className="flex items-center justify-between py-3 px-4 text-sm font-semibold uppercase tracking-wider rounded-lg text-[#d4af37] hover:bg-[#141414]"
                      >
                        <Settings className="h-4 w-4" />
                        Admin
                      </Link>
                    )}
                    <Link
                      to="/my-products"
                      onClick={() => setIsMenuOpen(false)}
                      className="flex items-center justify-between py-3 px-4 text-sm font-semibold uppercase tracking-wider rounded-lg text-[#737373] hover:text-[#d4af37] hover:bg-[#141414]"
                    >
                      <Package className="h-4 w-4" />
                      My Products
                    </Link>
                    <button
                      onClick={() => { handleLogout(); setIsMenuOpen(false); }}
                      className="w-full flex items-center justify-between py-3 px-4 text-sm font-semibold uppercase tracking-wider rounded-lg text-[#dc2626] hover:bg-[#141414]"
                    >
                      <LogOut className="h-4 w-4" />
                      Sign Out
                    </button>
                  </>
                ) : (
                  <Link
                    to="/auth"
                    onClick={() => setIsMenuOpen(false)}
                    className="block text-center py-3 px-4 text-sm font-semibold uppercase tracking-wider rounded-lg bg-[#d4af37] text-[#0a0a0a] hover:bg-[#c9a432]"
                  >
                    Sign In / Register
                  </Link>
                )}
              </div>
            </nav>
          </div>
        </>
      )}
    </>
  );
}
