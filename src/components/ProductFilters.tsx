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
  'pants': 'Celana',
  'shirts': 'Baju & Atasan',
  'jackets': 'Jaket',
  'dresses': 'Dress'
};

const conditionLabels: Record<string, string> = {
  'Excellent': 'Sangat Baik',
  'Good': 'Baik',
  'Fair': 'Cukup Baik'
};

const colorLabels: Record<string, string> = {
  'blue': 'biru',
  'black': 'hitam',
  'white': 'putih',
  'navy': 'navy',
  'khaki': 'khaki',
  'cream': 'krem',
  'brown': 'coklat',
  'burgundy': 'merah marun',
  'floral': 'motif bunga'
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

  const handleConditionChange = (condition: string, checked: boolean) => {
    const newConditions = checked
      ? [...filters.conditions, condition]
      : filters.conditions.filter(c => c !== condition);
    
    onFiltersChange({ ...filters, conditions: newConditions });
  };

  const handleBrandChange = (brand: string, checked: boolean) => {
    const newBrands = checked
      ? [...filters.brands, brand]
      : filters.brands.filter(b => b !== brand);
    
    onFiltersChange({ ...filters, brands: newBrands });
  };

  const handleSizeChange = (size: string, checked: boolean) => {
    const newSizes = checked
      ? [...filters.sizes, size]
      : filters.sizes.filter(s => s !== size);
    
    onFiltersChange({ ...filters, sizes: newSizes });
  };

  const handleColorChange = (color: string, checked: boolean) => {
    const newColors = checked
      ? [...filters.colors, color]
      : filters.colors.filter(c => c !== color);
    
    onFiltersChange({ ...filters, colors: newColors });
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

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('id-ID', { 
      style: 'currency', 
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(price);
  };

  return (
    <div className="bg-white p-6 rounded-lg border">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-medium flex items-center gap-2">
          <Filter className="h-4 w-4" />
          Filter
        </h3>
        <Button variant="ghost" size="sm" onClick={clearFilters}>
          Hapus Semua
        </Button>
      </div>

      <div className="space-y-6">
        {/* Categories */}
        <Collapsible defaultOpen>
          <CollapsibleTrigger className="w-full text-left font-medium">
            Kategori
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

        {/* Sizes */}
        <Collapsible defaultOpen>
          <CollapsibleTrigger className="w-full text-left font-medium">
            Ukuran
          </CollapsibleTrigger>
          <CollapsibleContent className="grid grid-cols-3 gap-2 mt-2">
            {availableSizes.map((size) => (
              <div key={size} className="flex items-center space-x-2">
                <Checkbox
                  id={`size-${size}`}
                  checked={filters.sizes.includes(size)}
                  onCheckedChange={(checked) => handleSizeChange(size, checked as boolean)}
                />
                <label 
                  htmlFor={`size-${size}`}
                  className="text-sm cursor-pointer"
                >
                  {size}
                </label>
              </div>
            ))}
          </CollapsibleContent>
        </Collapsible>

        <Separator />

        {/* Condition */}
        <Collapsible defaultOpen>
          <CollapsibleTrigger className="w-full text-left font-medium">
            Kondisi
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-2 mt-2">
            {['Excellent', 'Good', 'Fair'].map((condition) => (
              <div key={condition} className="flex items-center space-x-2">
                <Checkbox
                  id={`condition-${condition}`}
                  checked={filters.conditions.includes(condition)}
                  onCheckedChange={(checked) => handleConditionChange(condition, checked as boolean)}
                />
                <label 
                  htmlFor={`condition-${condition}`}
                  className="text-sm cursor-pointer"
                >
                  {conditionLabels[condition] || condition}
                </label>
              </div>
            ))}
          </CollapsibleContent>
        </Collapsible>

        <Separator />

        {/* Price Range */}
        <div>
          <h4 className="font-medium mb-3">Kisaran Harga</h4>
          <div className="px-2">
            <Slider
              value={filters.priceRange}
              onValueChange={handlePriceChange}
              max={maxPrice}
              min={0}
              step={50000}
              className="mb-2"
            />
            <div className="flex justify-between text-sm text-gray-500">
              <span>{formatPrice(filters.priceRange[0])}</span>
              <span>{formatPrice(filters.priceRange[1])}</span>
            </div>
          </div>
        </div>

        <Separator />

        {/* Colors */}
        <Collapsible>
          <CollapsibleTrigger className="w-full text-left font-medium">
            Warna
          </CollapsibleTrigger>
          <CollapsibleContent className="grid grid-cols-2 gap-2 mt-2">
            {availableColors.map((color) => (
              <div key={color} className="flex items-center space-x-2">
                <Checkbox
                  id={`color-${color}`}
                  checked={filters.colors.includes(color)}
                  onCheckedChange={(checked) => handleColorChange(color, checked as boolean)}
                />
                <label 
                  htmlFor={`color-${color}`}
                  className="text-sm cursor-pointer"
                >
                  {colorLabels[color] || color}
                </label>
              </div>
            ))}
          </CollapsibleContent>
        </Collapsible>

        <Separator />

        {/* Brands */}
        <Collapsible>
          <CollapsibleTrigger className="w-full text-left font-medium">
            Merek
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
      </div>
    </div>
  );
}