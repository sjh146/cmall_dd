import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { fetchProduct, addToCart as addToCartAPI, type Product as APIProduct } from '../lib/api';
import { getAgents, type Agent } from '../lib/paymentApi';
import AnalysisPurchase from '../components/AnalysisPurchase';
import { useCart } from '../contexts/CartContext';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { SimpleModal } from '../components/ui/SimpleModal';
import { Sparkline } from '../components/ProductCard';
import { 
  ArrowLeft, ShoppingCart, Star, Download, FileText, 
  CheckCircle, Clock, Shield, Tag, ExternalLink, Check, Wallet
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
  bg: 'bg-[#0e1215]',
  card: 'bg-[#151a1f]',
  cardBorder: 'border-[#262d33]',
  accent: 'text-[#b08a3e]',
  accentBg: 'bg-[#a9823a]',
  accentHover: 'hover:bg-[#8f6d2c]',
  accentBorder: 'border-[#a9823a]',
  text: 'text-[#f5f4f1]',
  textMuted: 'text-[#8b857b]',
  textSecondary: 'text-[#a8a29a]',
  gradient: 'bg-gradient-to-r from-[#a9823a] to-[#8f6d2c]',
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
  // AI 분석 상품(USDC 결제 대상) 여부 — /agents에서 requestType/cryptoPriceUsdc 조회
  const [agent, setAgent] = useState<Agent | null>(null);
  const isAnalysisProduct = agent !== null;

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    // 상품이 'AI 분석' 카테고리면 분석 결제 상품 정보 로드
    getAgents()
      .then((list) => {
        if (cancelled) return;
        const match = list.find((a) => String(a.id) === String(id));
        if (match) setAgent(match);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [id]);

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
        <div className="animate-spin w-8 h-8 border-2 border-[#a9823a] border-t-transparent rounded-full"></div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className={`min-h-screen ${theme.bg} flex flex-col items-center justify-center`}>
        <h2 className="text-xl font-semibold text-[#f5f4f1] mb-4">{error || 'Product not found'}</h2>
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
      <div className="border-b border-[#262d33] bg-[#0e1215] sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-[#8b857b] hover:text-[#b08a3e] transition-colors"
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
            <div className="aspect-square bg-[#151a1f] border border-[#262d33] rounded-xl overflow-hidden">
              {product.image ? (
                <img
                  src={product.image}
                  alt={product.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center gap-3">
                  <Sparkline tall />
                  <span className="font-terminal text-[11px] text-[#6f787e] tracking-[0.18em]">90D BACKTEST</span>
                </div>
              )}
              {discountPercentage > 0 && (
                <div className="absolute top-4 left-4 bg-[#a9823a] text-white text-sm font-bold px-3 py-1 rounded-full">
                  -{discountPercentage}% OFF
                </div>
              )}
            </div>
          </div>

          {/* Info Section */}
          <div className="space-y-6">
            {/* Category */}
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 bg-[#262d33] text-[#b08a3e] text-xs font-semibold uppercase rounded-full">
                {product.category || 'Product'}
              </span>
              {product.version && (
                <span className="px-3 py-1 bg-[#1d2329] text-[#8b857b] text-xs rounded-full flex items-center gap-1">
                  <Tag className="w-3 h-3" />
                  v{product.version}
                </span>
              )}
            </div>

            {/* Title */}
            <h1 className="text-3xl font-bold text-[#f5f4f1]">{product.name}</h1>

            {/* Price */}
            <div className="flex items-baseline gap-3">
              <span className="text-4xl font-bold text-[#b08a3e]">
                {formatPrice(product.price)}
              </span>
              {product.originalPrice && (
                <span className="text-xl text-[#8b857b] line-through">
                  {formatPrice(product.originalPrice)}
                </span>
              )}
            </div>

            {/* Description */}
            <p className="text-[#a8a29a] leading-relaxed">
              {product.description}
            </p>

            {/* File Info */}
            {product.fileSize && (
              <div className="flex items-center gap-4 text-sm text-[#8b857b]">
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

            {/* AI 분석 상품 → USDC 스마트컨트랙트 결제 패널 (FQT 쇼핑몰 통합) */}
            {isAnalysisProduct && agent ? (
              <div className="pt-2">
                <div className="flex items-center gap-2 mb-3 text-[#b08a3e] text-sm font-semibold">
                  <Wallet className="w-4 h-4" />
                  AI 분석 · USDC 결제 (Base Sepolia)
                </div>
                <AnalysisPurchase agent={agent} />
              </div>
            ) : (
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
            )}

            {/* Features & Requirements */}
            <div className="space-y-3 pt-4 border-t border-[#262d33]">
              {features.length > 0 && (
                <button
                  onClick={() => setShowFeatures(!showFeatures)}
                  className="w-full flex items-center justify-between p-4 bg-[#151a1f] border border-[#262d33] rounded-lg hover:hover:border-[#a9823a]/50 transition-colors"
                >
                  <span className="text-[#f5f4f1] font-medium">Features</span>
                  <span className="text-[#8b857b]">{features.length} items</span>
                </button>
              )}

              {requirements.length > 0 && (
                <button
                  onClick={() => setShowRequirements(!showRequirements)}
                  className="w-full flex items-center justify-between p-4 bg-[#151a1f] border border-[#262d33] rounded-lg hover:hover:border-[#a9823a]/50 transition-colors"
                >
                  <span className="text-[#f5f4f1] font-medium">System Requirements</span>
                  <span className="text-[#8b857b]">{requirements.length} items</span>
                </button>
              )}
            </div>

            {/* License Key */}
            {product.licenseKey && (
              <div className="p-4 bg-[#151a1f] border border-[#262d33] rounded-lg">
                <div className="flex items-center gap-2 text-[#8b857b] mb-2">
                  <Shield className="w-4 h-4" />
                  <span className="text-sm font-medium">License Key Included</span>
                </div>
                <p className="text-[#a8a29a] text-sm font-mono">{product.licenseKey}</p>
              </div>
            )}

            {/* Trust badges */}
            <div className="flex flex-wrap gap-4 pt-4">
              <div className="flex items-center gap-2 text-[#8b857b] text-sm">
                <CheckCircle className="w-4 h-4 text-green-500" />
                Instant Download
              </div>
              <div className="flex items-center gap-2 text-[#8b857b] text-sm">
                <Shield className="w-4 h-4 text-green-500" />
                Secure Payment
              </div>
              <div className="flex items-center gap-2 text-[#8b857b] text-sm">
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
            <li key={index} className="flex items-start gap-3 text-[#a8a29a]">
              <CheckCircle className="w-5 h-5 text-[#b08a3e] shrink-0 mt-0.5" />
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
            <li key={index} className="flex items-start gap-3 text-[#a8a29a]">
              <CheckCircle className="w-5 h-5 text-[#b08a3e] shrink-0 mt-0.5" />
              <span>{req}</span>
            </li>
          ))}
        </ul>
      </SimpleModal>
    </div>
  );
}
