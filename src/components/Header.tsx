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
}

export function Header({ cartItemCount, onCartClick, searchQuery, onSearchChange }: HeaderProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  return (
    <>
      <header className="bg-white border-b border-gray-100 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Mobile Menu Button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsMenuOpen(true)}
              className="md:hidden p-2 hover:bg-gray-50"
            >
              <Menu className="h-5 w-5 text-gray-700" />
            </Button>

            {/* Logo */}
            <div className="flex items-center flex-1 md:flex-none justify-center md:justify-start">
              <h1 className="text-xl font-semibold text-gray-900 tracking-tight">307 Second</h1>
            </div>

            {/* Desktop Navigation - Hidden on mobile */}
            <nav className="hidden md:flex space-x-8 flex-1 justify-center">
              <a href="#" className="text-sm font-medium text-gray-900 hover:text-gray-600 transition-colors">전체</a>
              <a href="#" className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">상의</a>
              <a href="#" className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">하의</a>
              <a href="#" className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">아우터</a>
              <a href="#" className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">원피스</a>
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
                  className="pl-11 h-10 bg-gray-50 border-0 rounded-md focus:bg-white focus:ring-1 focus:ring-gray-300"
                />
              </div>
            </div>

            {/* Mobile Search and Cart */}
            <div className="flex items-center space-x-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsSearchOpen(!isSearchOpen)}
                className="md:hidden p-2 hover:bg-gray-50"
              >
                <Search className="h-5 w-5 text-gray-700" />
              </Button>
              
              <Button
                variant="ghost"
                size="sm"
                onClick={onCartClick}
                className="relative p-2 hover:bg-gray-50"
              >
                <ShoppingCart className="h-5 w-5 text-gray-700" />
                {cartItemCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 bg-black text-white text-[10px] rounded-full h-4 w-4 flex items-center justify-center font-medium">
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
                  className="pl-10 h-10 bg-gray-50 border-0 rounded-md"
                  autoFocus
                />
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Mobile Navigation Sheet */}
      <Sheet open={isMenuOpen} onOpenChange={setIsMenuOpen}>
        <SheetContent side="left" className="w-80">
          <SheetHeader>
            <SheetTitle className="text-left">
              <div className="flex items-center">
                <span className="text-xl font-bold text-primary">307 Second</span>
                <span className="ml-2 text-sm text-muted-foreground">Toko Thrift</span>
              </div>
            </SheetTitle>
          </SheetHeader>
          
          <nav className="mt-8 space-y-4">
            <a 
              href="#" 
              className="block py-3 px-2 text-base text-gray-700 hover:text-primary hover:bg-gray-50 rounded-md transition-colors"
              onClick={() => setIsMenuOpen(false)}
            >
              Semua Pakaian
            </a>
            <a 
              href="#" 
              className="block py-3 px-2 text-base text-gray-700 hover:text-primary hover:bg-gray-50 rounded-md transition-colors"
              onClick={() => setIsMenuOpen(false)}
            >
              Baju &amp; Atasan
            </a>
            <a 
              href="#" 
              className="block py-3 px-2 text-base text-gray-700 hover:text-primary hover:bg-gray-50 rounded-md transition-colors"
              onClick={() => setIsMenuOpen(false)}
            >
              Celana
            </a>
            <a 
              href="#" 
              className="block py-3 px-2 text-base text-gray-700 hover:text-primary hover:bg-gray-50 rounded-md transition-colors"
              onClick={() => setIsMenuOpen(false)}
            >
              Jaket
            </a>
            <a 
              href="#" 
              className="block py-3 px-2 text-base text-gray-700 hover:text-primary hover:bg-gray-50 rounded-md transition-colors"
              onClick={() => setIsMenuOpen(false)}
            >
              Dress
            </a>
          </nav>
        </SheetContent>
      </Sheet>
    </>
  );
}