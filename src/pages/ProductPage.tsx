import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { fetchProduct, addToCart as addToCartAPI, type Product as APIProduct } from '../lib/api';
import { useCart } from '../contexts/CartContext';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { SimpleModal } from '../components/ui/SimpleModal';
import { 
  ArrowLeft, ShoppingCart, Star, Download, FileText, 
  CheckCircle, Clock, Shield, Tag, ExternalLink, Check
} from 'lucide-react';

interface Product {
  id: string;
  name: string;
  price: number;
  originalPrice?: number;
  image: string;
  category: string;
  description: string;
  version?: string;
  downloadUrl?: string;
  fileSize?: string;
  licenseKey?: string;
  features?: string;
  systemRequirements?: string;
}

// Financial dark theme colors
const theme = {
  bg: 'bg-[#0a0a0a]',
  card: 'bg-[#141414]',
  cardBorder: 'border-[#262626]',
  accent: 'text-[#d4af37]',
  accentBg: 'bg-[#d4af37]',
  accentHover: 'hover:bg-[#c9a432]',
  accentBorder: 'border-[#d4af37]',
  text: 'text-[#fafafa]',
  textMuted: 'text-[#737373]',
  textSecondary: 'text-[#a3a3a3]',
  gradient: 'bg-gradient-to-r from-[#d4af37] to-[#b8962e]',
};

export default function ProductPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { refreshCart } = useCart();
  const [product, setProduct] = useState<Product | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showFeatures, setShowFeatures] = useState(false);
  const [showRequirements, setShowRequirements] = useState(false);
  const [addingToCart, setAddingToCart] = useState(false);
  const [addedToCart, setAddedToCart] = useState(false);

  useEffect(() => {
    const loadProduct = async () => {
      if (!id) return;
      
      try {
        setIsLoading(true);
        const data = await fetchProduct(parseInt(id));
        setProduct({
          id: String(data.id),
          name: data.name,
          price: data.price,
          originalPrice: data.originalPrice,
          image: data.image,
          category: data.category,
          description: data.description,
          version: data.version,
          downloadUrl: data.downloadUrl,
          fileSize: data.fileSize,
          licenseKey: data.licenseKey,
          features: data.features,
          systemRequirements: data.systemRequirements,
        });
      } catch (err) {
        setError('Failed to load product');
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };

    loadProduct();
  }, [id]);

  const formatPrice = (price: number) => {
    return `$${(price / 100).toFixed(2)}`;
  };

  const discountPercentage = product?.originalPrice 
    ? Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)
    : 0;

  const handleAddToCart = async () => {
    if (!product) return;
    
    try {
      setAddingToCart(true);
      await addToCartAPI(parseInt(product.id), 1);
      await refreshCart();
      setAddedToCart(true);
      setTimeout(() => setAddedToCart(false), 2000);
    } catch (err) {
      console.error('Failed to add to cart:', err);
    } finally {
      setAddingToCart(false);
    }
  };

  if (isLoading) {
    return (
      <div className={`min-h-screen ${theme.bg} flex items-center justify-center`}>
        <div className="animate-spin w-8 h-8 border-2 border-[#d4af37] border-t-transparent rounded-full"></div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className={`min-h-screen ${theme.bg} flex flex-col items-center justify-center`}>
        <h2 className="text-xl font-semibold text-[#fafafa] mb-4">{error || 'Product not found'}</h2>
        <Link to="/">
          <Button className={`${theme.accentBg} text-black ${theme.accentHover}`}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Home
          </Button>
        </Link>
      </div>
    );
  }

  let features: string[] = [];
  let requirements: string[] = [];
  
  try {
    if (product.features) {
      features = JSON.parse(product.features);
    }
  } catch (e) {
    features = product.features ? [product.features] : [];
  }
  
  try {
    if (product.systemRequirements) {
      requirements = JSON.parse(product.systemRequirements);
    }
  } catch (e) {
    requirements = product.systemRequirements ? [product.systemRequirements] : [];
  }

  return (
    <div className={`min-h-screen ${theme.bg}`}>
      {/* Header */}
      <div className="border-b border-[#262626] bg-[#0a0a0a]/80 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-[#737373] hover:text-[#d4af37] transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Image Section */}
          <div className="relative">
            <div className="aspect-square bg-[#141414] border border-[#262626] rounded-xl overflow-hidden">
              {product.image ? (
                <img
                  src={product.image}
                  alt={product.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <span className="text-[#d4af37] text-8xl font-bold">
                    {product.category?.charAt(0).toUpperCase()}
                  </span>
                </div>
              )}
              {discountPercentage > 0 && (
                <div className="absolute top-4 left-4 bg-[#d4af37] text-[#0a0a0a] text-sm font-bold px-3 py-1 rounded-full">
                  -{discountPercentage}% OFF
                </div>
              )}
            </div>
          </div>

          {/* Info Section */}
          <div className="space-y-6">
            {/* Category */}
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 bg-[#262626] text-[#d4af37] text-xs font-semibold uppercase rounded-full">
                {product.category || 'Product'}
              </span>
              {product.version && (
                <span className="px-3 py-1 bg-[#1f1f1f] text-[#737373] text-xs rounded-full flex items-center gap-1">
                  <Tag className="w-3 h-3" />
                  v{product.version}
                </span>
              )}
            </div>

            {/* Title */}
            <h1 className="text-3xl font-bold text-[#fafafa]">{product.name}</h1>

            {/* Price */}
            <div className="flex items-baseline gap-3">
              <span className="text-4xl font-bold text-[#d4af37]">
                {formatPrice(product.price)}
              </span>
              {product.originalPrice && (
                <span className="text-xl text-[#737373] line-through">
                  {formatPrice(product.originalPrice)}
                </span>
              )}
            </div>

            {/* Description */}
            <p className="text-[#a3a3a3] leading-relaxed">
              {product.description}
            </p>

            {/* File Info */}
            {product.fileSize && (
              <div className="flex items-center gap-4 text-sm text-[#737373]">
                <span className="flex items-center gap-1">
                  <FileText className="w-4 h-4" />
                  {product.fileSize}
                </span>
                {product.downloadUrl && (
                  <span className="flex items-center gap-1">
                    <Download className="w-4 h-4" />
                    Download available
                  </span>
                )}
              </div>
            )}

            {/* Add to Cart */}
            <div className="flex gap-4 pt-4">
              <Button
                onClick={handleAddToCart}
                disabled={addingToCart}
                className={`flex-1 ${addedToCart ? 'bg-green-600 hover:bg-green-700' : theme.accentBg} text-black ${theme.accentHover} text-lg py-6`}
              >
                {addingToCart ? (
                  <span className="flex items-center">
                    <span className="animate-spin h-4 w-4 border-2 border-black border-t-transparent rounded-full mr-2"></span>
                    Adding...
                  </span>
                ) : addedToCart ? (
                  <span className="flex items-center">
                    <Check className="h-5 w-5 mr-2" />
                    Added!
                  </span>
                ) : (
                  <span className="flex items-center">
                    <ShoppingCart className="h-5 w-5 mr-2" />
                    Add to Cart
                  </span>
                )}
              </Button>
            </div>

            {/* Features & Requirements */}
            <div className="space-y-3 pt-4 border-t border-[#262626]">
              {features.length > 0 && (
                <button
                  onClick={() => setShowFeatures(!showFeatures)}
                  className="w-full flex items-center justify-between p-4 bg-[#141414] border border-[#262626] rounded-lg hover:border-[#d4af37]/50 transition-colors"
                >
                  <span className="text-[#fafafa] font-medium">Features</span>
                  <span className="text-[#737373]">{features.length} items</span>
                </button>
              )}

              {requirements.length > 0 && (
                <button
                  onClick={() => setShowRequirements(!showRequirements)}
                  className="w-full flex items-center justify-between p-4 bg-[#141414] border border-[#262626] rounded-lg hover:border-[#d4af37]/50 transition-colors"
                >
                  <span className="text-[#fafafa] font-medium">System Requirements</span>
                  <span className="text-[#737373]">{requirements.length} items</span>
                </button>
              )}
            </div>

            {/* License Key */}
            {product.licenseKey && (
              <div className="p-4 bg-[#141414] border border-[#262626] rounded-lg">
                <div className="flex items-center gap-2 text-[#737373] mb-2">
                  <Shield className="w-4 h-4" />
                  <span className="text-sm font-medium">License Key Included</span>
                </div>
                <p className="text-[#a3a3a3] text-sm font-mono">{product.licenseKey}</p>
              </div>
            )}

            {/* Trust badges */}
            <div className="flex flex-wrap gap-4 pt-4">
              <div className="flex items-center gap-2 text-[#737373] text-sm">
                <CheckCircle className="w-4 h-4 text-green-500" />
                Instant Download
              </div>
              <div className="flex items-center gap-2 text-[#737373] text-sm">
                <Shield className="w-4 h-4 text-green-500" />
                Secure Payment
              </div>
              <div className="flex items-center gap-2 text-[#737373] text-sm">
                <Clock className="w-4 h-4 text-green-500" />
                24/7 Support
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Features Modal */}
      <SimpleModal
        open={showFeatures}
        onClose={() => setShowFeatures(false)}
        title="Features"
        className="max-w-lg"
      >
        <ul className="space-y-3">
          {features.map((feature: string, index: number) => (
            <li key={index} className="flex items-start gap-3 text-[#a3a3a3]">
              <CheckCircle className="w-5 h-5 text-[#d4af37] shrink-0 mt-0.5" />
              <span>{feature}</span>
            </li>
          ))}
        </ul>
      </SimpleModal>

      {/* Requirements Modal */}
      <SimpleModal
        open={showRequirements}
        onClose={() => setShowRequirements(false)}
        title="System Requirements"
        className="max-w-lg"
      >
        <ul className="space-y-3">
          {requirements.map((req: string, index: number) => (
            <li key={index} className="flex items-start gap-3 text-[#a3a3a3]">
              <CheckCircle className="w-5 h-5 text-[#d4af37] shrink-0 mt-0.5" />
              <span>{req}</span>
            </li>
          ))}
        </ul>
      </SimpleModal>
    </div>
  );
}
