import { useEffect, useState } from 'react';
import {
  getAgents,
  createPayment,
  getPayment,
  createAnalysis,
  getAnalysis,
  getWalletAddress,
  payWithContract,
  pollPaymentUntilPaid,
  pollAnalysisUntilDone,
  type Agent,
  type Payment,
  type AnalysisRequest,
} from '../lib/paymentApi';
import WalletModal from '../components/WalletModal';

/**
 * AgentsPage — AI 분석 에이전트 상품 목록 + USDC 결제 + 분석 요청 (M3/M6)
 * 결제 흐름(온체인): 결제 생성(registerOrder) → 지갑에서 approve+pay() → getPayment 폴링 → paid
 */
export default function AgentsPage({ devMode }: { devMode?: boolean }) {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selected, setSelected] = useState<Agent | null>(null);
  const [payment, setPayment] = useState<Payment | null>(null);
  const [contractAddress, setContractAddress] = useState<string | null>(null);
  const [tokenAddress, setTokenAddress] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisRequest | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [symbol, setSymbol] = useState('005930');
  const [loading, setLoading] = useState(false);
  const [paying, setPaying] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // MetaMask 설치 여부에 따라 실지갑(devMode=false) / 개발모드 자동 선택
  const isDevMode = devMode ?? (typeof window === 'undefined' ? true : !(window as any).ethereum);

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
      // createPayment는 flat 응답 (Payment + contractAddress/tokenAddress)
      setPayment(resp);
      setContractAddress(resp.contractAddress || null);
      setTokenAddress(resp.tokenAddress || null);
      setMessage(
        `결제 주문이 생성됐습니다. 아래 '지갑에서 결제하기'로 ${(agent.cryptoPriceUsdc / 1_000_000).toFixed(2)} USDC를 컨트랙트에 직접 결제하세요.`
      );
    } catch (e: any) {
      setError(e.message || '결제 실패');
    } finally {
      setLoading(false);
    }
  }

  /** 지갑에서 approve + pay() 실행 → getPayment 폴링으로 paid 확인 */
  async function handlePayWithWallet() {
    if (!payment || !contractAddress) {
      setError('결제 주문이 없습니다. 먼저 상품을 선택해 결제 주문을 생성하세요.');
      return;
    }
    const ethereum = (window as any).ethereum;
    if (!ethereum) {
      setError('MetaMask가 설치되어 있지 않습니다. (개발 모드는 devMode)');
      return;
    }
    setPaying(true);
    setError(null);
    setMessage(null);
    try {
      setMessage('지갑에서 결제를 승인해주세요 (네트워크 스위치 → USDC approve → pay()).');
      const { txHash, approveTxHash } = await payWithContract(payment, contractAddress, tokenAddress, ethereum);
      setMessage(
        `✅ 온체인 결제 트랜잭션 전송됨: ${txHash.slice(0, 18)}… (approve: ${approveTxHash ? '✓' : '생략(기존 allowance)'}) — 결제 검증 대기 중...`
      );
      const paid = await pollPaymentUntilPaid(payment.referenceId, {
        intervalMs: 3000,
        timeoutMs: 180_000,
        onStatus: (s) => setMessage(`결제 검증 폴링 중... (상태: ${s})`),
      });
      setPayment(paid);
      setMessage(`🎉 결제 완료! (${(paid.amountUsdc / 1_000_000).toFixed(2)} USDC) — 구매한 분석을 자동 실행합니다.`);
      // 결제 완료 → 구매한 상품의 분석 타입으로 자동 실행 (M6)
      if (selected) {
        await runAnalysisForProduct(selected, symbol);
      }
    } catch (e: any) {
      setError(e.message || '지갑 결제 실패');
    } finally {
      setPaying(false);
    }
  }

  /** 결제 주문 재조회 (폴링/수동 새로고침용) */
  async function handleRefreshPayment() {
    if (!payment) return;
    setLoading(true);
    setError(null);
    try {
      const resp = await getPayment(payment.referenceId);
      setPayment(resp.payment);
      if (resp.verifyError) setMessage(`게이트웨이 응답: ${resp.verifyError}`);
    } catch (e: any) {
      setError(e.message || '결제 상태 조회 실패');
    } finally {
      setLoading(false);
    }
  }

  /**
   * 분석 요청 (M6 — 결제한 상품의 request_type으로 비동기 잡 실행)
   * stock_report는 즉시 done, 백테스트/스윙/팩터는 queued → 5초 폴링
   */
  async function runAnalysis(requestType: string, sym: string) {
    setAnalyzing(true);
    setError(null);
    setMessage(null);
    try {
      const req = await createAnalysis(sym, requestType);
      setAnalysis(req);
      if (req.status === 'failed') {
        setError(`분석 실패: ${req.error || 'analyist_dd 미연동'}`);
        return;
      }
      const label = requestType === 'stock_report' ? '주식 분석' : '분석 실행';
      const polled = await pollAnalysisUntilDone(req.id, {
        intervalMs: 5000,
        timeoutMs: 25 * 60_000,
        onStatus: (s) => {
          if (s === 'queued' || s === 'running') {
            setMessage(`⏳ ${label} 진행 중... (상태: ${s})`);
          }
        },
      });
      setAnalysis(polled);
      if (polled.status === 'done') {
        setMessage('✅ 분석 완료 — 결과가 아래에 표시됩니다.');
      } else {
        setError(`분석 실패: ${polled.error || '알 수 없는 오류'}`);
      }
    } catch (e: any) {
      setError(e.message || '분석 요청 실패');
    } finally {
      setAnalyzing(false);
    }
  }

  async function handleAnalyze() {
    const requestType = selected?.requestType || 'stock_report';
    await runAnalysis(requestType, symbol);
  }

  /** 결제 완료 후 구매한 상품의 분석 타입으로 자동 실행 (M6) */
  async function runAnalysisForProduct(agent: Agent, sym: string) {
    const requestType = agent.requestType || 'stock_report';
    await runAnalysis(requestType, sym);
  }

  const fmtUsdc = (micro: number) => `${(micro / 1_000_000).toFixed(2)} USDC`;

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-1">AI 분석 에이전트</h1>
      <p className="text-sm text-gray-600 mb-6">
        analyist_dd 엔진 기반 주식 분석 리포트를 USDC(Base L2)로 결제하고 받아보세요.
      </p>

      <WalletModal devMode={isDevMode} />

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
          {payment.txHash && (
            <p className="text-xs text-gray-500 break-all">
              tx:{' '}
              <a
                href={`https://sepolia.basescan.org/tx/${payment.txHash}`}
                target="_blank"
                rel="noreferrer"
                className="text-blue-600 underline"
              >
                {payment.txHash}
              </a>
            </p>
          )}
          {payment.status === 'pending' && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                onClick={handlePayWithWallet}
                disabled={paying || loading}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm disabled:opacity-50"
              >
                {paying ? '결제 진행 중...' : '지갑에서 결제하기'}
              </button>
              <button
                onClick={handleRefreshPayment}
                disabled={loading}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 disabled:opacity-50"
              >
                상태 새로고침
              </button>
              {contractAddress && (
                <span className="text-xs text-gray-500 break-all">
                  컨트랙트: <code className="bg-gray-200 px-1 rounded">{contractAddress}</code>
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {payment?.status === 'paid' && (
        <div className="mt-6 border rounded-lg p-4">
          <h3 className="font-semibold mb-1">분석 요청</h3>
          <p className="text-xs text-gray-500 mb-2">
            구매 상품: <b>{selected?.name}</b> · 분석 타입:{' '}
            <code className="bg-gray-100 px-1 rounded">{selected?.requestType || 'stock_report'}</code>
          </p>
          {selected?.requestType === 'stock_report' ? (
            <div className="flex gap-2">
              <input
                value={symbol}
                onChange={(e) => setSymbol(e.target.value)}
                placeholder="종목코드 (예: 005930)"
                className="border rounded px-3 py-2 text-sm flex-1"
              />
              <button
                onClick={handleAnalyze}
                disabled={loading || analyzing}
                className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm disabled:opacity-50"
              >
                {analyzing ? '분석 중...' : '분석 실행'}
              </button>
            </div>
          ) : (
            <button
              onClick={handleAnalyze}
              disabled={loading || analyzing}
              className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm disabled:opacity-50"
            >
              {analyzing ? '분석 실행 중...' : '분석 실행'}
            </button>
          )}
        </div>
      )}

      {analysis && analysis.status === 'done' && analysis.resultJson && (
        <AnalysisResultView requestType={analysis.requestType} resultJson={analysis.resultJson} />
      )}

      {message && <p className="mt-4 text-sm text-green-700">{message}</p>}
      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
    </div>
  );
}

// ── 분석 결과 렌더링 (M6 — 상품 타입별 구조화 뷰) ──────────────────────────

function AnalysisResultView({ requestType, resultJson }: { requestType: string; resultJson: string }) {
  let data: any;
  try {
    data = JSON.parse(resultJson);
  } catch {
    return (
      <div className="mt-6 border rounded-lg p-4 bg-green-50">
        <h3 className="font-semibold mb-2">📊 분석 결과</h3>
        <pre className="text-xs whitespace-pre-wrap bg-white p-3 rounded border">{resultJson}</pre>
      </div>
    );
  }
  return (
    <div className="mt-6 border rounded-lg p-4 bg-green-50">
      <h3 className="font-semibold mb-3">📊 분석 결과</h3>
      {requestType === 'backtest' && <BacktestView data={data} />}
      {requestType === 'swing_screener' && <SwingView data={data} />}
      {requestType === 'factor_report' && <FactorView data={data} />}
      {requestType === 'stock_report' && <StockReportView data={data} />}
      {!['backtest', 'swing_screener', 'factor_report', 'stock_report'].includes(requestType) && (
        <pre className="text-xs whitespace-pre-wrap bg-white p-3 rounded border">
          {JSON.stringify(data, null, 2)}
        </pre>
      )}
    </div>
  );
}

function BacktestView({ data }: { data: any }) {
  const m = data.metrics || {};
  const model = data.model || {};
  const trades: any[] = data.top_trades || [];
  const pct = (v: any, d = 2) => (typeof v === 'number' ? `${(v * 100).toFixed(d)}%` : '-');
  return (
    <div className="space-y-3 text-sm">
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-600">
        <span>기간: {data.window?.start} ~ {data.window?.end}</span>
        <span>유니버스: {data.universe_size}종목</span>
        <span>모델: {model.name} (AUC {model.auc})</span>
        <span>매수 임계값: {model.buy_threshold}</span>
      </div>
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="bg-gray-100">
            <th className="border p-1.5 text-left">지표</th>
            <th className="border p-1.5 text-left">값</th>
          </tr>
        </thead>
        <tbody>
          <tr><td className="border p-1.5">신호 수 (매수)</td><td className="border p-1.5">{m.num_trades ?? 0}건</td></tr>
          <tr><td className="border p-1.5">승률 (양수 수익 비율)</td><td className="border p-1.5">{pct(m.win_rate)}</td></tr>
          <tr><td className="border p-1.5">신호별 5일 수익률 합산</td><td className="border p-1.5">{pct(m.total_return)}</td></tr>
          <tr><td className="border p-1.5">샤프 비율</td><td className="border p-1.5">{m.sharpe_ratio ?? '-'}</td></tr>
          <tr><td className="border p-1.5">최대 낙폭</td><td className="border p-1.5">{pct(m.max_drawdown)}</td></tr>
        </tbody>
      </table>
      {trades.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold mb-1">최근 신호 상세 (최대 20건)</h4>
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-gray-100">
                <th className="border p-1.5 text-left">일자</th>
                <th className="border p-1.5 text-left">종목</th>
                <th className="border p-1.5 text-right">신뢰도</th>
                <th className="border p-1.5 text-right">5일 수익률</th>
              </tr>
            </thead>
            <tbody>
              {trades.map((t, i) => (
                <tr key={i}>
                  <td className="border p-1.5">{t.date}</td>
                  <td className="border p-1.5">{t.stock_code}</td>
                  <td className="border p-1.5 text-right">{t.confidence?.toFixed?.(3) ?? t.confidence}</td>
                  <td className="border p-1.5 text-right">{pct(t.actual_return)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {trades.length === 0 && (
        <p className="text-xs text-gray-500">신호가 없습니다 (임계값 이상 예측 없음 — 모델 성능 참고).</p>
      )}
    </div>
  );
}

function SwingView({ data }: { data: any }) {
  const cands: any[] = data.candidates || [...(data.top_up || []), ...(data.top_down || [])];
  return (
    <div className="space-y-3 text-sm">
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-600">
        <span>스크리닝일: {data.date || data.generated_at}</span>
        <span>전체 후보: {data.total ?? cands.length}종목</span>
        <span>상승 예측: {data.up ?? '-'} / 하락 예측: {data.down ?? '-'}</span>
        <span>고신뢰(≥0.65): {data.high_confidence ?? '-'}</span>
        <span>모델 AUC: {data.auc}</span>
      </div>
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="bg-gray-100">
            <th className="border p-1.5 text-left">종목</th>
            <th className="border p-1.5 text-left">이름</th>
            <th className="border p-1.5 text-left">섹터</th>
            <th className="border p-1.5 text-right">상승확률</th>
            <th className="border p-1.5 text-right">신뢰도</th>
            <th className="border p-1.5 text-right">기대수익</th>
            <th className="border p-1.5 text-center">방향</th>
          </tr>
        </thead>
        <tbody>
          {cands.slice(0, 30).map((c, i) => (
            <tr key={i}>
              <td className="border p-1.5">{c.stock_code ?? c.code ?? '-'}</td>
              <td className="border p-1.5">{c.stock_name ?? c.name ?? '-'}</td>
              <td className="border p-1.5">{c.sector ?? '-'}</td>
              <td className="border p-1.5 text-right">{typeof c.prob === 'number' ? c.prob.toFixed(4) : '-'}</td>
              <td className="border p-1.5 text-right">{typeof c.confidence === 'number' ? c.confidence.toFixed(4) : (c.conf ?? '-')}</td>
              <td className="border p-1.5 text-right">
                {typeof c.expected_return === 'number' ? `${c.expected_return.toFixed(1)}%` : '-'}
              </td>
              <td className="border p-1.5 text-center">{c.dir ?? (c.prob >= 0.5 ? 'UP' : 'DOWN')}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {cands.length === 0 && <p className="text-xs text-gray-500">후보 종목이 없습니다.</p>}
    </div>
  );
}

function FactorView({ data }: { data: any }) {
  const strategies = data.strategies || {};
  const rows = Object.entries(strategies).map(([name, s]: [string, any]) => ({ name, ...(s.metrics || {}) }));
  const pct = (v: any, d = 2) => (typeof v === 'number' ? `${(v * 100).toFixed(d)}%` : '-');
  return (
    <div className="space-y-3 text-sm">
      <p className="text-xs text-gray-600">
        강환국『하면 된다! 퀀트투자』 5종 팩터 전략 — 실 DB(market_data/financial_statements) 기반 리밸런싱 백테스트 · 생성: {data.generated_at}
      </p>
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="bg-gray-100">
            <th className="border p-1.5 text-left">전략</th>
            <th className="border p-1.5 text-right">총수익률</th>
            <th className="border p-1.5 text-right">샤프</th>
            <th className="border p-1.5 text-right">최대낙폭</th>
            <th className="border p-1.5 text-right">승률</th>
            <th className="border p-1.5 text-right">리밸런싱</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.name}>
              <td className="border p-1.5">{r.name}</td>
              <td className="border p-1.5 text-right">{pct(r.total_return)}</td>
              <td className="border p-1.5 text-right">{r.sharpe ?? '-'}</td>
              <td className="border p-1.5 text-right">{pct(r.max_drawdown)}</td>
              <td className="border p-1.5 text-right">{pct(r.win_rate)}</td>
              <td className="border p-1.5 text-right">{r.num_trades ?? '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StockReportView({ data }: { data: any }) {
  const sum = data.summary || {};
  const preds: any[] = data.predictions || [];
  const senti: any[] = data.sentiment || [];
  const mkt: any[] = data.market_data || [];
  return (
    <div className="space-y-3 text-sm">
      <div className="text-xs bg-white rounded border p-2">
        <b>{sum.symbol}</b> · 예측 방향: <b>{sum.verdict}</b> (신뢰도 {sum.confidence ?? '-'}) · 감성:{' '}
        {sum.sentiment_label ?? '-'} · 최근 종가: {sum.last_close ?? '-'}
      </div>
      {preds.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold mb-1">ML 예측</h4>
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-gray-100">
                <th className="border p-1.5 text-left">일자</th>
                <th className="border p-1.5 text-left">방향</th>
                <th className="border p-1.5 text-right">변화율</th>
                <th className="border p-1.5 text-right">신뢰도</th>
              </tr>
            </thead>
            <tbody>
              {preds.map((p, i) => (
                <tr key={i}>
                  <td className="border p-1.5">{p.date}</td>
                  <td className="border p-1.5">{p.direction}</td>
                  <td className="border p-1.5 text-right">{p.change_pct}%</td>
                  <td className="border p-1.5 text-right">{p.confidence}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {mkt.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold mb-1">최근 시세</h4>
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-gray-100">
                <th className="border p-1.5 text-left">일자</th>
                <th className="border p-1.5 text-right">시가</th>
                <th className="border p-1.5 text-right">고가</th>
                <th className="border p-1.5 text-right">저가</th>
                <th className="border p-1.5 text-right">종가</th>
                <th className="border p-1.5 text-right">거래량</th>
              </tr>
            </thead>
            <tbody>
              {mkt.map((m, i) => (
                <tr key={i}>
                  <td className="border p-1.5">{m.trade_date}</td>
                  <td className="border p-1.5 text-right">{m.open}</td>
                  <td className="border p-1.5 text-right">{m.high}</td>
                  <td className="border p-1.5 text-right">{m.low}</td>
                  <td className="border p-1.5 text-right">{m.close}</td>
                  <td className="border p-1.5 text-right">{m.volume}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
