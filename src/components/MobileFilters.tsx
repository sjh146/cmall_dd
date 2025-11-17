import { Filter, SlidersHorizontal } from 'lucide-react';
import { Button } from './ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from './ui/sheet';
import { ProductFilters, FilterOptions } from './ProductFilters';
import { useState } from 'react';

interface MobileFiltersProps {
  filters: FilterOptions;
  onFiltersChange: (filters: FilterOptions) => void;
  availableCategories: string[];
  availableBrands: string[];
  availableSizes: string[];
  availableColors: string[];
  maxPrice: number;
  activeFiltersCount: number;
}

export function MobileFilters({
  filters,
  onFiltersChange,
  availableCategories,
  availableBrands,
  availableSizes,
  availableColors,
  maxPrice,
  activeFiltersCount
}: MobileFiltersProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Button 
        variant="outline" 
        size="sm" 
        className="flex-1 relative"
        onClick={() => setIsOpen(true)}
      >
        <SlidersHorizontal className="h-4 w-4 mr-2" />
        Filter
        {activeFiltersCount > 0 && (
          <span className="absolute -top-2 -right-2 bg-primary text-primary-foreground text-xs rounded-full h-5 w-5 flex items-center justify-center">
            {activeFiltersCount}
          </span>
        )}
      </Button>

      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetContent side="bottom" className="h-[85vh] overflow-hidden">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filter Produk
            </SheetTitle>
          </SheetHeader>
          <div className="overflow-y-auto h-full pb-16 mt-4">
            <ProductFilters
              filters={filters}
              onFiltersChange={onFiltersChange}
              availableCategories={availableCategories}
              availableBrands={availableBrands}
              availableSizes={availableSizes}
              availableColors={availableColors}
              maxPrice={maxPrice}
            />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}