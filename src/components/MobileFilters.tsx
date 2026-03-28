import { Filter, SlidersHorizontal, X } from 'lucide-react';
import { Button } from './ui/button';
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

  if (!isOpen) {
    return (
      <Button 
        variant="outline" 
        size="sm" 
        className="flex-1 relative"
        onClick={() => setIsOpen(true)}
      >
        <SlidersHorizontal className="h-4 w-4 mr-2" />
        Filter
        {activeFiltersCount > 0 && (
          <span className="absolute -top-2 -right-2 bg-[#d4af37] text-black text-xs rounded-full h-5 w-5 flex items-center justify-center font-bold">
            {activeFiltersCount}
          </span>
        )}
      </Button>
    );
  }

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/60" onClick={() => setIsOpen(false)} />
      <div className="absolute bottom-0 left-0 right-0 bg-[#141414] border-t border-[#262626] rounded-t-2xl max-h-[85vh] overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-[#262626]">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-[#fafafa]">
            <Filter className="h-5 w-5" />
            Filters
          </h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsOpen(false)}
            className="text-[#737373] hover:text-[#fafafa]"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
        <div className="overflow-y-auto h-[calc(85vh-70px)] p-4 pb-16">
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
      </div>
    </div>
  );
}