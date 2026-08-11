import { useEffect, useState } from 'react';
import {
  getAgents,
  createPayment,
  getPayment,
  createAnalysis,
  getAnalysis,
  getWalletAddress,
  type Agent,
  type Payment,
  type AnalysisRequest,
} from '../lib/paymentApi';
import WalletModal from '../components/WalletModal';

/**
 * AgentsPage — AI 분석 에이전트 상품 목록 + USDC 결제 + 분석 요청 (M3)
 * 결제 흐름(dev-mock): 결제 생성 → 게이트웨이 검증(즉시) → paid → 분석 요청
 */
export default function AgentsPage({ devMode = false }: { devMode?: boolean }) {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selected, setSelected] = useState<Agent | null>(null);
  const [payment, setPayment] = useState<Payment | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisRequest | null>(null);
  const [symbol, setSymbol] = useState('005930');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getAgents().then(setAgents).catch(() => setAgents([]));
  }, []);

  async function handleBuy(agent: Agent) {
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      if (!getWalletAddress()) {
        throw new Error('먼저 지갑을 연결하세요.');
      }
      const resp = await createPayment(agent.id);
      setSelected(agent);
      setPayment(resp.payment);

      // dev-mock: 게이트웨이가 즉시 검증 → 폴링으로 상태 갱신
      const polled = await getPayment(resp.payment.referenceId);
      setPayment(polled.payment);
      if (polled.verifyError) {
        setMessage(`게이트웨이 미기동: ${polled.verifyError}`);
      } else if (polled.payment.status === 'paid') {
        setMessage(`✅ 결제 완료 (${(agent.cryptoPriceUsdc / 1_000_000).toFixed(2)} USDC) — 분석을 요청할 수 있습니다.`);
      }
    } catch (e: any) {
      setError(e.message || '결제 실패');
    } finally {
      setLoading(false);
    }
  }

  async function handleAnalyze() {
    setLoading(true);
    setError(null);
    try {
      const req = await createAnalysis(symbol, 'stock_report');
      setAnalysis(req);
      if (req.status === 'failed') {
        setError(`분석 실패: ${req.error || 'analyist_dd 미연동'}`);
      } else {
        const polled = await getAnalysis(req.id);
        setAnalysis(polled);
        if (polled.status === 'done') {
          setMessage('✅ 분석 완료 — 결과가 아래에 표시됩니다.');
        }
      }
    } catch (e: any) {
      setError(e.message || '분석 요청 실패');
    } finally {
      setLoading(false);
    }
  }

  const fmtUsdc = (micro: number) => `${(micro / 1_000_000).toFixed(2)} USDC`;

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-1">AI 분석 에이전트</h1>
      <p className="text-sm text-gray-600 mb-6">
        analyist_dd 엔진 기반 주식 분석 리포트를 USDC(Base L2)로 결제하고 받아보세요.
      </p>

      <WalletModal devMode={devMode} />

      <div className="grid md:grid-cols-2 gap-4 mt-6">
        {agents.map((agent) => (
          <div key={agent.id} className="border rounded-lg p-4 flex flex-col gap-2">
            <h3 className="font-semibold">{agent.name}</h3>
            <p className="text-sm text-gray-600 line-clamp-2">{agent.description}</p>
            <div className="flex items-center justify-between mt-2">
              <span className="text-lg font-bold text-indigo-600">{fmtUsdc(agent.cryptoPriceUsdc)}</span>
              <button
                onClick={() => handleBuy(agent)}
                disabled={loading}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm disabled:opacity-50"
              >
                {loading && selected?.id === agent.id ? '처리 중...' : '결제하고 구매'}
              </button>
            </div>
          </div>
        ))}
        {agents.length === 0 && (
          <p className="text-sm text-gray-500 col-span-2">
            판매 중인 분석 상품이 없습니다. (관리자가 products.crypto_price_usdc를 설정해야 표시됩니다)
          </p>
        )}
      </div>

      {payment && (
        <div className="mt-6 border rounded-lg p-4 bg-gray-50">
          <h3 className="font-semibold mb-2">결제 정보</h3>
          <p className="text-sm">reference: <code className="bg-gray-200 px-1 rounded">{payment.referenceId}</code></p>
          <p className="text-sm">금액: {fmtUsdc(payment.amountUsdc)} · 상태: <b>{payment.status}</b></p>
          {payment.txHash && <p className="text-xs text-gray-500 break-all">tx: {payment.txHash}</p>}
        </div>
      )}

      {payment?.status === 'paid' && (
        <div className="mt-6 border rounded-lg p-4">
          <h3 className="font-semibold mb-2">분석 요청</h3>
          <div className="flex gap-2">
            <input
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
              placeholder="종목코드 (예: 005930)"
              className="border rounded px-3 py-2 text-sm flex-1"
            />
            <button
              onClick={handleAnalyze}
              disabled={loading}
              className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm disabled:opacity-50"
            >
              {loading ? '분석 중...' : '분석 실행'}
            </button>
          </div>
        </div>
      )}

      {analysis && analysis.status === 'done' && analysis.resultJson && (
        <div className="mt-6 border rounded-lg p-4 bg-green-50">
          <h3 className="font-semibold mb-2">📊 분석 결과</h3>
          <pre className="text-xs whitespace-pre-wrap bg-white p-3 rounded border">
            {JSON.stringify(JSON.parse(analysis.resultJson), null, 2)}
          </pre>
        </div>
      )}

      {message && <p className="mt-4 text-sm text-green-700">{message}</p>}
      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
    </div>
  );
}
