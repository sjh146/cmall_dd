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
      <header className="bg-white border-b sticky top-0 z-50">
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14 sm:h-16">
            {/* Mobile Menu Button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsMenuOpen(true)}
              className="md:hidden p-2"
            >
              <Menu className="h-5 w-5" />
            </Button>

            {/* Logo */}
            <div className="flex items-center flex-1 md:flex-none justify-center md:justify-start">
              <h1 className="text-xl sm:text-2xl font-bold text-primary">307 Second</h1>
              <span className="ml-2 text-xs sm:text-sm text-muted-foreground hidden sm:inline">Toko Thrift</span>
            </div>

            {/* Desktop Navigation - Hidden on mobile */}
            <nav className="hidden md:flex space-x-6 lg:space-x-8 flex-1 justify-center">
              <a href="#" className="text-sm text-gray-700 hover:text-primary transition-colors">Semua Pakaian</a>
              <a href="#" className="text-sm text-gray-700 hover:text-primary transition-colors">Baju &amp; Atasan</a>
              <a href="#" className="text-sm text-gray-700 hover:text-primary transition-colors">Celana</a>
              <a href="#" className="text-sm text-gray-700 hover:text-primary transition-colors">Jaket</a>
              <a href="#" className="text-sm text-gray-700 hover:text-primary transition-colors">Dress</a>
            </nav>

            {/* Desktop Search - Hidden on mobile */}
            <div className="hidden md:flex flex-1 max-w-lg mx-4">
              <div className="relative w-full">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  type="search"
                  placeholder="Cari pakaian..."
                  value={searchQuery}
                  onChange={(e) => onSearchChange(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Mobile Search and Cart */}
            <div className="flex items-center space-x-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsSearchOpen(!isSearchOpen)}
                className="md:hidden p-2"
              >
                <Search className="h-5 w-5" />
              </Button>
              
              <Button
                variant="ghost"
                size="sm"
                onClick={onCartClick}
                className="relative p-2"
              >
                <ShoppingCart className="h-5 w-5" />
                {cartItemCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-xs rounded-full h-5 w-5 flex items-center justify-center">
                    {cartItemCount}
                  </span>
                )}
              </Button>
            </div>
          </div>

          {/* Mobile Search Bar */}
          {isSearchOpen && (
            <div className="md:hidden pb-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  type="search"
                  placeholder="Cari pakaian..."
                  value={searchQuery}
                  onChange={(e) => onSearchChange(e.target.value)}
                  className="pl-10"
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