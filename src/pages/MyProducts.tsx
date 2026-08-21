import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { fetchMyProducts, deleteProduct, downloadAnalysisResult, type Product } from '../lib/api';
import { fetchMyPurchases, type PurchaseItem } from '../lib/paymentApi';
import { AnalysisResultView } from '../components/AnalysisPurchase';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Alert, AlertDescription } from '../components/ui/alert';
import { ArrowLeft, Plus, Package, Trash2, Edit, ExternalLink, ReceiptText, ChevronDown, ChevronUp } from 'lucide-react';

const fmtUsdc = (micro: number) => `${(micro / 1_000_000).toFixed(2)} USDC`;
const fmtDate = (iso: string) => {
  try {
    return new Date(iso).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  } catch {
    return iso;
  }
};

export default function MyProducts() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [purchases, setPurchases] = useState<PurchaseItem[]>([]);
  const [purchasesLoading, setPurchasesLoading] = useState(true);
  const [expandedRef, setExpandedRef] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      loadProducts();
      loadPurchases();
    } else {
      setLoading(false);
      setPurchasesLoading(false);
    }
  }, [user]);

  const loadPurchases = async () => {
    try {
      setPurchasesLoading(true);
      const data = await fetchMyPurchases();
      setPurchases(data);
    } catch {
      setPurchases([]);
    } finally {
      setPurchasesLoading(false);
    }
  };

  const loadProducts = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await fetchMyProducts();
      setProducts(data);
    } catch (err) {
      setError('Failed to load your products');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this product?')) {
      return;
    }

    try {
      setDeletingId(id);
      await deleteProduct(id);
      setProducts(products.filter(p => p.id !== id));
    } catch (err) {
      setError('Failed to delete product');
    } finally {
      setDeletingId(null);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <CardTitle>Sign In Required</CardTitle>
            <CardDescription>You need to sign in to view your products.</CardDescription>
          </CardHeader>
          <CardContent className="justify-center flex">
            <Link to="/auth">
              <Button>Sign In</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-background border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link to="/" className="flex items-center gap-2">
              <ArrowLeft className="h-5 w-5" />
              <span className="text-3xl font-bold" style={{ fontFamily: 'Permanent Marker, cursive' }}>
                DevMall
              </span>
            </Link>
            <Link to="/seller">
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Add Product
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">My Products</h1>
            <p className="text-muted-foreground mt-2">
              Manage your {products.length} product{products.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>

        {/* ── 구매 내역 (분석 결과 목차) ── */}
        <section className="mb-10">
          <div className="flex items-center gap-2 mb-4">
            <ReceiptText className="h-5 w-5 text-[#b8860b]" />
            <h2 className="text-xl font-bold">📦 구매 내역 & 분석 결과</h2>
          </div>

          {purchasesLoading ? (
            <p className="text-sm text-muted-foreground">구매 내역을 불러오는 중...</p>
          ) : purchases.length === 0 ? (
            <Card className="bg-white border border-[#e5e5e5]">
              <CardContent className="py-8 text-center">
                <p className="text-sm text-[#6b7280]">아직 결제한 분석 상품이 없습니다.</p>
                <Link to="/" className="text-sm text-[#b8860b] underline mt-1 inline-block">
                  쇼핑몰에서 AI 분석 상품 구매하기 →
                </Link>
              </CardContent>
            </Card>
          ) : (
            <div className="bg-white border border-[#e5e5e5] rounded-lg overflow-hidden">
              {/* 목차 헤더 */}
              <div className="grid grid-cols-12 gap-2 px-4 py-2.5 bg-[#f5f5f5] text-xs font-semibold text-[#374151] border-b border-[#e5e5e5]">
                <span className="col-span-4 sm:col-span-3">상품</span>
                <span className="col-span-2 sm:col-span-1 text-center">금액</span>
                <span className="col-span-3 sm:col-span-2 text-center">결제일</span>
                <span className="col-span-3 sm:col-span-2 text-center">분석</span>
                <span className="hidden sm:block col-span-3 text-right">결과</span>
                <span className="col-span-0 sm:hidden" />
              </div>
              {purchases.map((p) => {
                const open = expandedRef === p.referenceId;
                const hasResult = !!p.resultJson;
                return (
                  <div key={p.referenceId} className="border-b border-[#e5e5e5] last:border-b-0">
                    <button
                      onClick={() => setExpandedRef(open ? null : p.referenceId)}
                      className="w-full grid grid-cols-12 gap-2 items-center px-4 py-3 text-left hover:bg-[#fafafa] transition-colors"
                    >
                      <span className="col-span-4 sm:col-span-3 text-sm font-medium text-[#111111] truncate">
                        {p.productName}
                      </span>
                      <span className="col-span-2 sm:col-span-1 text-sm text-[#b8860b] text-center">
                        {fmtUsdc(p.amountUsdc)}
                      </span>
                      <span className="col-span-3 sm:col-span-2 text-xs text-[#6b7280] text-center">
                        {fmtDate(p.purchasedAt)}
                      </span>
                      <span className="col-span-3 sm:col-span-2 text-center">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-medium ${
                            p.analysisStatus === 'done'
                              ? 'bg-green-100 text-green-700'
                              : p.analysisStatus === 'running'
                                ? 'bg-amber-100 text-amber-700'
                                : p.analysisStatus === 'failed'
                                  ? 'bg-red-100 text-red-700'
                                  : 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {p.analysisStatus === 'done' ? '✅ 완료' : p.analysisStatus === 'running' ? '⏳ 진행 중' : p.analysisStatus === 'failed' ? '❌ 실패' : '대기'}
                        </span>
                      </span>
                      <span className="hidden sm:block col-span-3 text-right text-xs text-[#6b7280]">
                        {hasResult ? '결과 보기' : '—'}
                      </span>
                      <span className="col-span-0 sm:hidden" />
                      <span className="absolute" />
                      {open ? <ChevronUp className="h-4 w-4 text-[#6b7280]" /> : <ChevronDown className="h-4 w-4 text-[#6b7280]" />}
                    </button>
                    {open && (
                      <div className="px-4 pb-4 bg-[#fafafa] border-t border-[#e5e5e5]">
                        <p className="text-[11px] text-[#6b7280] mb-2 mt-2">
                          결제: {p.referenceId} · 지갑: {p.walletAddress.slice(0, 10)}… · tx:{' '}
                          {p.txHash ? p.txHash.slice(0, 14) + '…' : '-'} · 분석 요청 #{p.analysisId}
                        </p>
                        {hasResult ? (
                          <>
                            <AnalysisResultView requestType={p.requestType} resultJson={p.resultJson} />
                            <div className="flex flex-wrap gap-2 mt-3">
                              <button
                                onClick={async () => {
                                  try {
                                    await downloadAnalysisResult(p.analysisId, 'csv');
                                  } catch (e) {
                                    alert(e instanceof Error ? e.message : '다운로드 실패');
                                  }
                                }}
                                className="px-3 py-1.5 text-xs border border-[#a9823a] text-[#8f6d2c] hover:bg-[#f5efe0] rounded transition-colors"
                              >
                                CSV 다운로드
                              </button>
                              <button
                                onClick={async () => {
                                  try {
                                    await downloadAnalysisResult(p.analysisId, 'json');
                                  } catch (e) {
                                    alert(e instanceof Error ? e.message : '다운로드 실패');
                                  }
                                }}
                                className="px-3 py-1.5 text-xs border border-[#d1d5db] text-[#4b5563] hover:bg-[#f9fafb] rounded transition-colors"
                              >
                                JSON 다운로드
                              </button>
                            </div>
                          </>
                        ) : (
                          <p className="text-sm text-[#6b7280]">
                            {p.analysisStatus === 'running'
                              ? '⏳ 분석이 진행 중입니다. 잠시 후 새로고침해주세요.'
                              : p.analysisStatus === 'failed'
                                ? '❌ 분석 실행에 실패했습니다.'
                                : '결과가 아직 없습니다.'}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {loading ? (
          <div className="text-center py-20">
            <p className="text-muted-foreground">Loading your products...</p>
          </div>
        ) : products.length === 0 ? (
          <Card className="text-center py-12">
            <CardContent>
              <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Products Yet</h3>
              <p className="text-muted-foreground mb-6">
                Start selling by adding your first product.
              </p>
              <Link to="/seller">
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Your First Product
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {products.map((product) => (
              <Card key={product.id} className="overflow-hidden">
                <div className="flex flex-col sm:flex-row">
                  {/* Product Image */}
                  <div className="sm:w-48 h-32 sm:h-auto bg-secondary flex items-center justify-center shrink-0">
                    {product.image ? (
                      <img
                        src={product.image}
                        alt={product.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-4xl">
                        {product.productType === 'software' ? '💻' : '📚'}
                      </span>
                    )}
                  </div>

                  {/* Product Info */}
                  <div className="flex-1 p-4">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`px-2 py-0.5 text-xs font-medium rounded ${
                            product.productType === 'software' 
                              ? 'bg-blue-100 text-blue-700' 
                              : 'bg-green-100 text-green-700'
                          }`}>
                            {product.productType === 'software' ? 'Software' : 'E-Book'}
                          </span>
                          {product.version && (
                            <span className="text-xs text-muted-foreground">
                              v{product.version}
                            </span>
                          )}
                        </div>
                        <h3 className="font-semibold text-lg">{product.name}</h3>
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                          {product.description || 'No description'}
                        </p>
                      </div>

                      <div className="text-right shrink-0">
                        <div className="text-xl font-bold">
                          ${(product.price / 100).toFixed(2)}
                        </div>
                        {product.category && (
                          <div className="text-sm text-muted-foreground capitalize">
                            {product.category}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 mt-4">
                      {product.downloadUrl && (
                        <a
                          href={product.downloadUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-primary hover:underline flex items-center gap-1"
                        >
                          <ExternalLink className="h-3 w-3" />
                          View Download
                        </a>
                      )}
                      <div className="flex-1" />
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => handleDelete(product.id)}
                        disabled={deletingId === product.id}
                      >
                        <Trash2 className="h-4 w-4 mr-1" />
                        {deletingId === product.id ? 'Deleting...' : 'Delete'}
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
