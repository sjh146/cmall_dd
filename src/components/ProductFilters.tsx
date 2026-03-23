import { Filter } from 'lucide-react';
import { Button } from './ui/button';
import { Checkbox } from './ui/checkbox';
import { Slider } from './ui/slider';
import { Separator } from './ui/separator';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from './ui/collapsible';

export interface FilterOptions {
  categories: string[];
  conditions: string[];
  priceRange: [number, number];
  brands: string[];
  sizes: string[];
  colors: string[];
}

interface ProductFiltersProps {
  filters: FilterOptions;
  onFiltersChange: (filters: FilterOptions) => void;
  availableCategories: string[];
  availableBrands: string[];
  availableSizes: string[];
  availableColors: string[];
  maxPrice: number;
}

const categoryLabels: Record<string, string> = {
  'software': 'Software',
  'ebook': 'E-Books',
  'productivity': 'Productivity',
  'development': 'Development Tools',
  'design': 'Design & Graphics',
  'utilities': 'Utilities',
  'education': 'Education & Learning',
  'business': 'Business & Finance',
  'lifestyle': 'Lifestyle',
  'other': 'Other'
};

const formatPrice = (price: number) => {
  return `$${(price / 100).toFixed(2)}`;
};

export function ProductFilters({ 
  filters, 
  onFiltersChange, 
  availableCategories, 
  availableBrands,
  availableSizes,
  availableColors,
  maxPrice 
}: ProductFiltersProps) {
  const handleCategoryChange = (category: string, checked: boolean) => {
    const newCategories = checked
      ? [...filters.categories, category]
      : filters.categories.filter(c => c !== category);
    
    onFiltersChange({ ...filters, categories: newCategories });
  };

  const handleBrandChange = (brand: string, checked: boolean) => {
    const newBrands = checked
      ? [...filters.brands, brand]
      : filters.brands.filter(b => b !== brand);
    
    onFiltersChange({ ...filters, brands: newBrands });
  };

  const handlePriceChange = (value: number[]) => {
    onFiltersChange({ ...filters, priceRange: [value[0], value[1]] });
  };

  const clearFilters = () => {
    onFiltersChange({
      categories: [],
      conditions: [],
      priceRange: [0, maxPrice],
      brands: [],
      sizes: [],
      colors: []
    });
  };

  return (
    <div className="bg-card p-6 rounded-lg border">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-medium flex items-center gap-2">
          <Filter className="h-4 w-4" />
          Filters
        </h3>
        <Button variant="ghost" size="sm" onClick={clearFilters}>
          Clear All
        </Button>
      </div>

      <div className="space-y-6">
        {/* Categories */}
        {availableCategories.length > 0 && (
          <>
            <Collapsible defaultOpen>
              <CollapsibleTrigger className="w-full text-left font-medium">
                Categories
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-2 mt-2">
                {availableCategories.map((category) => (
                  <div key={category} className="flex items-center space-x-2">
                    <Checkbox
                      id={`category-${category}`}
                      checked={filters.categories.includes(category)}
                      onCheckedChange={(checked) => handleCategoryChange(category, checked as boolean)}
                    />
                    <label 
                      htmlFor={`category-${category}`}
                      className="text-sm cursor-pointer"
                    >
                      {categoryLabels[category] || category}
                    </label>
                  </div>
                ))}
              </CollapsibleContent>
            </Collapsible>

            <Separator />
          </>
        )}

        {/* Price Range */}
        <div>
          <h4 className="font-medium mb-3">Price Range</h4>
          <div className="px-2">
            <Slider
              value={filters.priceRange}
              onValueChange={handlePriceChange}
              max={maxPrice}
              min={0}
              step={100}
              className="mb-2"
            />
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>{formatPrice(filters.priceRange[0])}</span>
              <span>{formatPrice(filters.priceRange[1])}</span>
            </div>
          </div>
        </div>

        <Separator />

        {/* Brands */}
        {availableBrands.length > 0 && (
          <Collapsible>
            <CollapsibleTrigger className="w-full text-left font-medium">
              Brands
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-2 mt-2 max-h-40 overflow-y-auto">
              {availableBrands.slice(0, 10).map((brand) => (
                <div key={brand} className="flex items-center space-x-2">
                  <Checkbox
                    id={`brand-${brand}`}
                    checked={filters.brands.includes(brand)}
                    onCheckedChange={(checked) => handleBrandChange(brand, checked as boolean)}
                  />
                  <label 
                    htmlFor={`brand-${brand}`}
                    className="text-sm cursor-pointer"
                  >
                    {brand}
                  </label>
                </div>
              ))}
            </CollapsibleContent>
          </Collapsible>
        )}
      </div>
    </div>
  );
}
