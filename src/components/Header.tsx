import { Search, ShoppingCart, Menu } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from './ui/sheet';
import { useState } from 'react';

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
  'shirts': 'shirts',
  'pants': 'pants',
  'jackets': 'jackets',
  'dresses': 'dresses'
};

export function Header({ cartItemCount, onCartClick, searchQuery, onSearchChange, selectedCategory = 'all', onCategoryChange }: HeaderProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  const handleCategoryClick = (categoryKey: string) => {
    if (onCategoryChange) {
      onCategoryChange(categoryMap[categoryKey]);
    }
    setIsMenuOpen(false);
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

            <h1 className="text-5xl md:text-7xl font-bold tracking-wider" style={{ fontFamily: 'Permanent Marker, cursive' }}>
              yun&nora
            </h1>

            {/* Desktop Navigation - Hidden on mobile */}
            <nav className="hidden md:flex space-x-6 flex-1 justify-center">
              <button
                onClick={() => handleCategoryClick('all')}
                className={`text-sm font-bold uppercase tracking-wider transition-all ${
                  selectedCategory === 'all' || selectedCategory === ''
                    ? 'text-primary'
                    : 'text-gray-400 hover:text-primary'
                }`}
              >
                Semua Pakaian
              </button>
              <button
                onClick={() => handleCategoryClick('shirts')}
                className={`text-sm font-bold uppercase tracking-wider transition-all ${
                  selectedCategory === 'shirts'
                    ? 'text-primary'
                    : 'text-gray-400 hover:text-primary'
                }`}
              >
                Baju & Atasan
              </button>
              <button
                onClick={() => handleCategoryClick('pants')}
                className={`text-sm font-bold uppercase tracking-wider transition-all ${
                  selectedCategory === 'pants'
                    ? 'text-primary'
                    : 'text-gray-400 hover:text-primary'
                }`}
              >
                Celana
              </button>
              <button
                onClick={() => handleCategoryClick('jackets')}
                className={`text-sm font-bold uppercase tracking-wider transition-all ${
                  selectedCategory === 'jackets'
                    ? 'text-primary'
                    : 'text-gray-400 hover:text-primary'
                }`}
              >
                Jaket
              </button>
              <button
                onClick={() => handleCategoryClick('dresses')}
                className={`text-sm font-bold uppercase tracking-wider transition-all ${
                  selectedCategory === 'dresses'
                    ? 'text-primary'
                    : 'text-gray-400 hover:text-primary'
                }`}
              >
                Dress
              </button>
            </nav>

            {/* Desktop Search - Hidden on mobile */}
            <div className="hidden md:flex flex-1 max-w-md mx-8">
              <div className="relative w-full">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  type="search"
                  placeholder="브랜드, 상품명 검색"
                  value={searchQuery}
                  onChange={(e) => onSearchChange(e.target.value)}
                  className="pl-11 h-10 bg-secondary border-0 rounded-md focus:bg-secondary focus:ring-1 focus:ring-primary text-foreground placeholder:text-muted-foreground"
                />
              </div>
            </div>

            {/* Mobile Search and Cart */}
            <div className="flex items-center space-x-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsSearchOpen(!isSearchOpen)}
                className="md:hidden p-2 hover:bg-secondary"
              >
                <Search className="h-5 w-5 text-foreground" />
              </Button>
              
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
                  placeholder="브랜드, 상품명 검색"
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
              <div className="flex flex-col items-start">
                <span className="text-4xl font-bold" style={{ fontFamily: 'Permanent Marker, cursive' }}>
                  yun&nora
                </span>
                <span className="text-sm text-muted-foreground">Thrift Shop</span>
              </div>
            </SheetTitle>
          </SheetHeader>
          
          <nav className="mt-8 space-y-4">
            <button
              onClick={() => handleCategoryClick('all')}
              className={`w-full text-left block py-3 px-2 text-base font-bold uppercase tracking-wider rounded-md transition-all ${
                selectedCategory === 'all' || selectedCategory === ''
                  ? 'text-primary bg-secondary'
                  : 'text-gray-400 hover:text-primary hover:bg-secondary'
              }`}
            >
              Semua Pakaian
            </button>
            <button
              onClick={() => handleCategoryClick('shirts')}
              className={`w-full text-left block py-3 px-2 text-base font-bold uppercase tracking-wider rounded-md transition-all ${
                selectedCategory === 'shirts'
                  ? 'text-primary bg-secondary'
                  : 'text-gray-400 hover:text-primary hover:bg-secondary'
              }`}
            >
              Baju & Atasan
            </button>
            <button
              onClick={() => handleCategoryClick('pants')}
              className={`w-full text-left block py-3 px-2 text-base font-bold uppercase tracking-wider rounded-md transition-all ${
                selectedCategory === 'pants'
                  ? 'text-primary bg-secondary'
                  : 'text-gray-400 hover:text-primary hover:bg-secondary'
              }`}
            >
              Celana
            </button>
            <button
              onClick={() => handleCategoryClick('jackets')}
              className={`w-full text-left block py-3 px-2 text-base font-bold uppercase tracking-wider rounded-md transition-all ${
                selectedCategory === 'jackets'
                  ? 'text-primary bg-secondary'
                  : 'text-gray-400 hover:text-primary hover:bg-secondary'
              }`}
            >
              Jaket
            </button>
            <button
              onClick={() => handleCategoryClick('dresses')}
              className={`w-full text-left block py-3 px-2 text-base font-bold uppercase tracking-wider rounded-md transition-all ${
                selectedCategory === 'dresses'
                  ? 'text-primary bg-secondary'
                  : 'text-gray-400 hover:text-primary hover:bg-secondary'
              }`}
            >
              Dress
            </button>
          </nav>
        </SheetContent>
      </Sheet>
    </>
  );
}
