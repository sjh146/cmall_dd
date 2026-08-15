// ── AI 분석 구매 패널 (M6 — FQT 쇼핑몰 통합) ─────────────────────────────
// 상품 상세(/product/:id)와 /agents에서 공용으로 사용하는
// USDC 스마트컨트랙트 결제 + 분석 자동 실행 + 결과 표시 흐름.
// 흐름: 결제 주문 생성 → 지갑 approve+pay() → paid 폴링 → 구매 상품의
// request_type으로 분석 자동 실행(queued→폴링) → 결과 구조화 렌더링.
import { useState, useEffect } from 'react';
import {
  createPayment,
  createPaymentDev,
  devPay,
  getPayment,
  createAnalysis,
  getWalletAddress,
  loginWithWallet,
  payWithContract,
  pollPaymentUntilPaid,
  pollAnalysisUntilDone,
  getSubscriptionIntent,
  getActiveSubscription,
  subscribeWithContract,
  recordSubscription,
  type Agent,
  type Payment,
  type AnalysisRequest,
  type ActiveSubscription,
} from '../lib/paymentApi';
import { getWalletProviderKind, getActiveProvider, setWalletProviderKind, WALLETCONNECT_CONFIGURED, connectWithAppKit } from '../lib/walletProviders';

const fmtUsdc = (micro: number) => `${(micro / 1_000_000).toFixed(2)} USDC`;

const c = {
  // 2026-08: USDC 결제 박스 베이지색 (사용자 요청)
  card: 'bg-[#f5efe0] border border-[#e0d5b8] rounded-lg',
  text: 'text-[#111111]',
  muted: 'text-[#6b7280]',
  accent: 'text-[#d4af37]',
  accentBg: 'bg-[#d4af37]',
  input: 'bg-[#f5f5f5] border border-[#e5e5e5] rounded-lg px-3 py-2 text-sm text-[#111111] focus:outline-none focus:border-[#d4af37]',
};

export default function AnalysisPurchase({ agent }: { agent: Agent }) {
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
  // M6 구독 상태
  const [subscribing, setSubscribing] = useState(false);
  const [subStatus, setSubStatus] = useState<ActiveSubscription | null>(null);

  const isBundle = agent.requestType === 'subscription_bundle';

  // 구독 상품이면 마운트 시 온체인 활성 구독 확인
  useEffect(() => {
    const w = getWalletAddress();
    if (isBundle && w) {
      getActiveSubscription(w, Number(agent.id))
        .then((s) => {
          if (s.active) setSubStatus(s);
        })
        .catch(() => {});
    }
  }, [isBundle, agent.id]);

  const requestType = agent.requestType || 'stock_report';
  // 운영자 대행(dev) 경로: 주소 직접 입력으로 연결한 경우만 (MetaMask/AppKit 연결자는 서명 가능)
  const addressOnly = getWalletProviderKind() === 'address';

  async function handleBuy() {
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const walletAddr = getWalletAddress();
      if (!walletAddr) {
        throw new Error('먼저 지갑을 연결하세요 (로그인 후 연결).');
      }
      // 지갑 세션 자동 복원: 이메일 로그인이 토큰을 덮어썼으면(지갑 클레임 소실)
      // 결제 전에 지갑 세션으로 재인증한다. (실측: 지갑 연결 후 이메일 재로그인 → 400 wallet not connected)
      const kind = getWalletProviderKind();
      if (kind === 'address') {
        // dev 주소 경로: 무서명 재인증 (DEV_SKIP_SIGNATURE)
        await loginWithWallet(null, true, walletAddr);
      } else {
        const active = await getActiveProvider();
        if (active) {
          try {
            await loginWithWallet(active.provider, false);
          } catch {
            /* 서명 거부 시 기존 토큰으로 진행 — 백엔드가 거부하면 아래에서 안내 */
          }
        }
      }
      const resp = addressOnly
        ? await createPaymentDev(agent.id)
        : await createPayment(agent.id);
      setPayment(resp);
      setContractAddress(resp.contractAddress || null);
      setTokenAddress(resp.tokenAddress || null);
      setMessage(
        addressOnly
          ? `결제 주문이 생성됐습니다. 아래 '주소로 결제'를 누르면 운영자 지갑이 결제를 대행합니다 (테스트넷 데모).`
          : `결제 주문이 생성됐습니다. 아래 '지갑에서 결제하기'로 ${fmtUsdc(agent.cryptoPriceUsdc)}를 컨트랙트에 직접 결제하세요.`
      );
    } catch (e: any) {
      setError(e.message || '결제 실패');
    } finally {
      setLoading(false);
    }
  }

  /** 주소만 연결한 사용자: 운영자 키로 approve+pay 대행 → paid 폴링 */
  async function handleDevPay() {
    if (!payment) {
      setError('결제 주문이 없습니다. 먼저 결제 주문을 생성하세요.');
      return;
    }
    setPaying(true);
    setError(null);
    setMessage(null);
    try {
      setMessage('운영자 지갑이 온체인 결제를 실행합니다 (approve + pay)...');
      const res = await devPay(payment.referenceId);
      setMessage(`✅ 결제 트랜잭션 전송됨: ${(res.txHash || '').slice(0, 18)}… — 검증 대기 중...`);
      const paid = await pollPaymentUntilPaid(payment.referenceId, {
        intervalMs: 3000,
        timeoutMs: 180_000,
        onStatus: (s) => setMessage(`결제 검증 폴링 중... (상태: ${s})`),
      });
      setPayment(paid);
      setMessage(`🎉 결제 완료! (${fmtUsdc(paid.amountUsdc)}) — 구매한 분석을 자동 실행합니다.`);
      await runAnalysis(requestType, symbol);
    } catch (e: any) {
      setError(e.message || '대행 결제 실패');
    } finally {
      setPaying(false);
    }
  }

  /** 지갑에서 approve + pay() 실행 → getPayment 폴링으로 paid 확인 → 분석 자동 실행 */
  async function handlePayWithWallet() {
    if (!payment || !contractAddress) {
      setError('결제 주문이 없습니다. 먼저 결제 주문을 생성하세요.');
      return;
    }
    // 활성 프로바이저: MetaMask → AppKit(이메일/소셜/모바일 지갑) 순서.
    // 없으면 자동 재연결 시도 (잠긴 MetaMask 해제, AppKit 세션 복원)
    let active = await getActiveProvider();
    if (!active) {
      const ethereum = (window as any).ethereum;
      if (ethereum) {
        try {
          setMessage('지갑 연결을 승인해주세요 (MetaMask 잠금 해제/연결 확인)...');
          const accounts = await ethereum.request({ method: 'eth_requestAccounts' });
          if (accounts?.[0]) {
            setWalletProviderKind('injected');
            active = { provider: ethereum, address: accounts[0] };
          }
        } catch {
          /* 사용자가 연결 거부 */
        }
      }
      if (!active && WALLETCONNECT_CONFIGURED) {
        try {
          setMessage('지갑 연결 창을 열고 있습니다 — 이메일/QR로 연결해주세요...');
          const conn = await connectWithAppKit();
          setWalletProviderKind('appkit');
          active = conn;
        } catch {
          /* 모달 취소 */
        }
      }
      if (!active) {
        setError('지갑이 연결되어 있지 않습니다. 로그인 후 지갑을 연결하세요.');
        return;
      }
    }
    setPaying(true);
    setError(null);
    setMessage(null);
    try {
      setMessage('지갑에서 결제를 승인해주세요 (네트워크 스위치 → USDC approve → pay()).');
      const { txHash, approveTxHash } = await payWithContract(payment, contractAddress, tokenAddress, active.provider);
      setMessage(
        `✅ 온체인 결제 트랜잭션 전송됨: ${txHash.slice(0, 18)}… (approve: ${approveTxHash ? '✓' : '생략(기존 allowance)'}) — 결제 검증 대기 중...`
      );
      const paid = await pollPaymentUntilPaid(payment.referenceId, {
        intervalMs: 3000,
        timeoutMs: 180_000,
        onStatus: (s) => setMessage(`결제 검증 폴링 중... (상태: ${s})`),
      });
      setPayment(paid);
      setMessage(`🎉 결제 완료! (${fmtUsdc(paid.amountUsdc)}) — 구매한 분석을 자동 실행합니다.`);
      await runAnalysis(requestType, symbol);
    } catch (e: any) {
      setError(e.message || '지갑 결제 실패');
    } finally {
      setPaying(false);
    }
  }

  /** M6: 구독 시작 — approve(USDC) + subscribe() → 온체인 검증 → DB 기록 */
  async function handleSubscribe() {
    setSubscribing(true);
    setError(null);
    setMessage(null);
    try {
      const walletAddr = getWalletAddress();
      if (!walletAddr) {
        throw new Error('먼저 지갑을 연결하세요 (로그인 후 연결).');
      }
      if (getWalletProviderKind() === 'address') {
        throw new Error('주소 직접 연결(운영자 대행)은 구독을 지원하지 않습니다. MetaMask 또는 지갑 연결을 사용해주세요.');
      }
      // 지갑 세션 자동 복원 (일회성 결제 흐름과 동일)
      const active = await getActiveProvider();
      if (active) {
        try {
          await loginWithWallet(active.provider, false);
        } catch {
          /* 서명 거부 시 기존 토큰으로 진행 */
        }
      }
      // ① 구독 의도 (컨트랙트/금액)
      const intent = await getSubscriptionIntent(Number(agent.id));
      const provider = await getActiveProvider();
      if (!provider) throw new Error('지갑이 연결되어 있지 않습니다.');
      // ② 지갑 approve + subscribe (1회 서명)
      setMessage('지갑에서 구독을 승인해주세요 (네트워크 스위치 → USDC approve → subscribe()).');
      const { txHash, subscriptionId } = await subscribeWithContract(intent, provider.provider);
      // ③ 온체인 활성 검증
      const status = await getActiveSubscription(walletAddr, Number(agent.id));
      if (!status.active) {
        throw new Error('온체인 구독이 확인되지 않습니다 — 잠시 후 다시 시도해주세요.');
      }
      // ④ DB 기록 (entitlements용 — 만료 시 자동 차단)
      const periodEnd = status.expiresAt
        ? new Date(Number(status.expiresAt) * 1000).toISOString()
        : new Date(Date.now() + 30 * 86400 * 1000).toISOString();
      await recordSubscription(Number(agent.id), walletAddr, subscriptionId, periodEnd);
      setSubStatus(status);
      setMessage(`구독 시작! (tx ${txHash.slice(0, 18)}…) 이제 모든 분석 서비스를 이용하실 수 있습니다.`);
    } catch (e: any) {
      setError(e.message || '구독 실패');
    } finally {
      setSubscribing(false);
    }
  }

  /** 결제 주문 재조회 */
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

  /** 분석 요청 (비동기 잡 → 5초 폴링) */
  async function runAnalysis(type: string, sym: string) {
    setAnalyzing(true);
    setError(null);
    setMessage(null);
    try {
      const req = await createAnalysis(sym, type);
      setAnalysis(req);
      if (req.status === 'failed') {
        setError(`분석 실패: ${req.error || 'analyist_dd 미연동'}`);
        return;
      }
      const label = type === 'stock_report' ? '주식 분석' : '분석 실행';
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

  return (
    <div className={`${c.card} p-5 space-y-4`}>
      {isBundle ? (
        <>
          <div>
            <h3 className={`font-semibold ${c.text}`}>🔗 올액세스 구독 (월 5 USDC)</h3>
            <p className={`text-xs ${c.muted} mt-1`}>
              스크리너/팩터/리포트 등 전 분석 서비스를 제한 없이 이용할 수 있습니다. 한 번 결제하면 매월 자동 갱신되고, 원할 때 취소할 수 있습니다.
            </p>
          </div>
          {!subStatus ? (
            <div className="space-y-2">
              {!getWalletAddress() && (
                <p className={`text-xs ${c.muted}`}>
                  💡 구독 전 지갑 연결이 필요합니다.{' '}
                  <a href="/auth" className="text-blue-600 underline">
                    지갑 연결하러 가기 →
                  </a>
                </p>
              )}
              <button
                onClick={handleSubscribe}
                disabled={subscribing || !getWalletAddress()}
                className={`w-full px-4 py-3 ${c.accentBg} text-black rounded-lg text-sm font-semibold disabled:opacity-50`}
              >
                {subscribing ? '구독 진행 중...' : `구독 시작 — 월 ${fmtUsdc(agent.cryptoPriceUsdc)}`}
              </button>
            </div>
          ) : (
            <div className="space-y-1 text-sm">
              <p className="font-semibold text-green-700">구독 활성 — 모든 분석 서비스 이용 가능</p>
              <p className={`text-xs ${c.muted}`}>
                구독 #{subStatus.subscriptionId} · 다음 갱신:{' '}
                {subStatus.expiresAt
                  ? new Date(Number(subStatus.expiresAt) * 1000).toLocaleDateString()
                  : '-'}
              </p>
            </div>
          )}
          {message && <p className="text-sm text-green-600">{message}</p>}
          {error && <p className="text-sm text-red-500">{error}</p>}
        </>
      ) : (
        <>
      <div>
        <h3 className={`font-semibold ${c.text}`}>🔗 USDC 결제로 분석 구매</h3>
        <p className={`text-xs ${c.muted} mt-1`}>
          스마트컨트랙트 직접 결제 (Base Sepolia) · 결제 완료 시 {agent.name} 분석이 자동 실행됩니다.
        </p>
      </div>

      {!payment && (
        <div className="space-y-2">
          {!getWalletAddress() && (
            <p className={`text-xs ${c.muted}`}>
              💡 결제 전 지갑 연결이 필요합니다.{' '}
              <a href="/auth" className="text-blue-600 underline">
                지갑 연결하러 가기 →
              </a>
            </p>
          )}
          <button
            onClick={handleBuy}
            disabled={loading}
            className={`w-full px-4 py-3 ${c.accentBg} text-black rounded-lg text-sm font-semibold disabled:opacity-50`}
          >
            {loading ? '주문 생성 중...' : `결제하고 구매 — ${fmtUsdc(agent.cryptoPriceUsdc)}`}
          </button>
        </div>
      )}

      {payment && (
        <div className="space-y-3 text-sm">
          <p className={`${c.muted} text-xs`}>
            reference: <code className="bg-[#f5f5f5] px-1 rounded">{payment.referenceId}</code>
          </p>
          <p className={c.text}>
            금액: <b className={c.accent}>{fmtUsdc(payment.amountUsdc)}</b> · 상태: <b>{payment.status}</b>
          </p>
          {payment.txHash && (
            <p className={`text-xs ${c.muted} break-all`}>
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
            <div className="flex flex-wrap items-center gap-2">
              {addressOnly ? (
                <button
                  onClick={handleDevPay}
                  disabled={paying || loading}
                  className={`px-4 py-2 ${c.accentBg} text-black rounded-lg text-sm font-semibold disabled:opacity-50`}
                >
                  {paying ? '결제 실행 중...' : '주소로 결제 (운영자 대행)'}
                </button>
              ) : (
                <button
                  onClick={handlePayWithWallet}
                  disabled={paying || loading}
                  className={`px-4 py-2 ${c.accentBg} text-black rounded-lg text-sm font-semibold disabled:opacity-50`}
                >
                  {paying ? '결제 진행 중...' : '지갑에서 결제하기'}
                </button>
              )}
              <button
                onClick={handleRefreshPayment}
                disabled={loading}
                className="px-3 py-2 border border-[#e5e5e5] rounded-lg text-sm text-[#4b5563] disabled:opacity-50"
              >
                상태 새로고침
              </button>
            </div>
          )}
        </div>
      )}

      {payment?.status === 'paid' && !analysis && (
        <div className="space-y-2">
          {requestType === 'stock_report' ? (
            <div className="flex gap-2">
              <input
                value={symbol}
                onChange={(e) => setSymbol(e.target.value)}
                placeholder="종목코드 (예: 005930)"
                className={`${c.input} flex-1`}
              />
              <button
                onClick={() => runAnalysis(requestType, symbol)}
                disabled={analyzing}
                className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm disabled:opacity-50"
              >
                {analyzing ? '분석 중...' : '분석 실행'}
              </button>
            </div>
          ) : (
            <button
              onClick={() => runAnalysis(requestType, symbol)}
              disabled={analyzing}
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

      {message && <p className="text-sm text-green-400">{message}</p>}
      {error && <p className="text-sm text-red-400">{error}</p>}
        </>
      )}
    </div>
  );
}

// ── 분석 결과 렌더링 (상품 타입별 구조화 뷰) ──────────────────────────────

export function AnalysisResultView({ requestType, resultJson }: { requestType: string; resultJson: string }) {
  let data: any;
  try {
    data = JSON.parse(resultJson);
  } catch {
    return (
      <div className="bg-[#f5f5f5] border border-[#e5e5e5] rounded-lg p-3">
        <h4 className="font-semibold mb-2 text-[#111111]">📊 분석 결과</h4>
        <pre className="text-xs whitespace-pre-wrap text-[#4b5563]">{resultJson}</pre>
      </div>
    );
  }
  return (
    <div className="bg-[#f5f5f5] border border-[#e5e5e5] rounded-lg p-3 space-y-3">
      <h4 className="font-semibold text-[#111111]">📊 분석 결과</h4>
      {requestType === 'backtest' && <BacktestView data={data} />}
      {requestType === 'swing_screener' && <SwingView data={data} />}
      {requestType === 'factor_report' && <FactorView data={data} />}
      {requestType === 'stock_report' && <StockReportView data={data} />}
      {!['backtest', 'swing_screener', 'factor_report', 'stock_report'].includes(requestType) && (
        <pre className="text-xs whitespace-pre-wrap text-[#4b5563]">{JSON.stringify(data, null, 2)}</pre>
      )}
    </div>
  );
}

const pct = (v: any, d = 2) => (typeof v === 'number' ? `${(v * 100).toFixed(d)}%` : '-');
const th = 'border border-[#e5e5e5] p-1.5 text-left';
const td = 'border border-[#e5e5e5] p-1.5';
const headCls = `${th} bg-[#f5f5f5] text-[#b8860b] font-semibold`;

function BacktestView({ data }: { data: any }) {
  const m = data.metrics || {};
  const model = data.model || {};
  const trades: any[] = data.top_trades || [];
  return (
    <div className="space-y-3 text-sm text-[#4b5563]">
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
        <span>기간: {data.window?.start} ~ {data.window?.end}</span>
        <span>유니버스: {data.universe_size}종목</span>
        <span>모델: {model.name} (AUC {model.auc})</span>
        <span>매수 임계값: {model.buy_threshold}</span>
      </div>
      <table className="w-full text-xs border-collapse text-[#111111]">
        <tbody>
          <tr><td className={td}>신호 수 (매수)</td><td className={td}>{m.num_trades ?? 0}건</td></tr>
          <tr><td className={td}>승률 (양수 수익 비율)</td><td className={td}>{pct(m.win_rate)}</td></tr>
          <tr><td className={td}>신호별 5일 수익률 합산</td><td className={td}>{pct(m.total_return)}</td></tr>
          <tr><td className={td}>샤프 비율</td><td className={td}>{m.sharpe_ratio ?? '-'}</td></tr>
          <tr><td className={td}>최대 낙폭</td><td className={td}>{pct(m.max_drawdown)}</td></tr>
        </tbody>
      </table>
      {trades.length > 0 && (
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr><th className={headCls}>일자</th><th className={headCls}>종목</th><th className={headCls}>신뢰도</th><th className={headCls}>5일 수익률</th></tr>
          </thead>
          <tbody>
            {trades.map((t, i) => (
              <tr key={i}>
                <td className={td}>{t.date}</td>
                <td className={td}>{t.stock_code}</td>
                <td className={td}>{t.confidence?.toFixed?.(3) ?? t.confidence}</td>
                <td className={td}>{pct(t.actual_return)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {trades.length === 0 && <p className="text-xs">신호가 없습니다 (임계값 이상 예측 없음 — 모델 성능 참고).</p>}
    </div>
  );
}

function SwingView({ data }: { data: any }) {
  const cands: any[] = data.candidates || [...(data.top_up || []), ...(data.top_down || [])];
  return (
    <div className="space-y-3 text-sm text-[#4b5563]">
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
        <span>스크리닝일: {data.date || data.generated_at}</span>
        <span>후보: {data.total ?? cands.length}종목</span>
        <span>상승: {data.up ?? '-'} / 하락: {data.down ?? '-'}</span>
        <span>고신뢰: {data.high_confidence ?? '-'}</span>
        <span>모델 AUC: {data.auc}</span>
      </div>
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr><th className={headCls}>종목</th><th className={headCls}>이름</th><th className={headCls}>섹터</th><th className={headCls}>상승확률</th><th className={headCls}>신뢰도</th><th className={headCls}>기대수익</th><th className={headCls}>방향</th></tr>
        </thead>
        <tbody>
          {cands.slice(0, 30).map((cand, i) => (
            <tr key={i}>
              <td className={td}>{cand.stock_code ?? cand.code ?? '-'}</td>
              <td className={td}>{cand.stock_name ?? cand.name ?? '-'}</td>
              <td className={td}>{cand.sector ?? '-'}</td>
              <td className={td}>{typeof cand.prob === 'number' ? cand.prob.toFixed(4) : '-'}</td>
              <td className={td}>{typeof cand.confidence === 'number' ? cand.confidence.toFixed(4) : (cand.conf ?? '-')}</td>
              <td className={td}>{typeof cand.expected_return === 'number' ? `${cand.expected_return.toFixed(1)}%` : '-'}</td>
              <td className={td}>{cand.dir ?? (cand.prob >= 0.5 ? 'UP' : 'DOWN')}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {cands.length === 0 && <p className="text-xs">후보 종목이 없습니다.</p>}
    </div>
  );
}

function FactorView({ data }: { data: any }) {
  const strategies = data.strategies || {};
  const rows = Object.entries(strategies).map(([name, s]: [string, any]) => ({ name, ...(s.metrics || {}) }));
  return (
    <div className="space-y-3 text-sm text-[#4b5563]">
      <p className="text-xs">강환국『하면 된다! 퀀트투자』5종 팩터 — 실 DB 기반 리밸런싱 백테스트 · {data.generated_at}</p>
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr><th className={headCls}>전략</th><th className={headCls}>총수익률</th><th className={headCls}>샤프</th><th className={headCls}>최대낙폭</th><th className={headCls}>승률</th><th className={headCls}>리밸런싱</th></tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.name}>
              <td className={td}>{r.name}</td>
              <td className={td}>{pct(r.total_return)}</td>
              <td className={td}>{r.sharpe ?? '-'}</td>
              <td className={td}>{pct(r.max_drawdown)}</td>
              <td className={td}>{pct(r.win_rate)}</td>
              <td className={td}>{r.num_trades ?? '-'}</td>
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
  const mkt: any[] = data.market_data || [];
  return (
    <div className="space-y-3 text-sm text-[#4b5563]">
      <div className="text-xs bg-white rounded border border-[#e5e5e5] p-2">
        <b className="text-[#111111]">{sum.symbol}</b> · 예측: <b>{sum.verdict}</b> (신뢰도 {sum.confidence ?? '-'}) · 감성: {sum.sentiment_label ?? '-'} · 종가: {sum.last_close ?? '-'}
      </div>
      {preds.length > 0 && (
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr><th className={headCls}>일자</th><th className={headCls}>방향</th><th className={headCls}>변화율</th><th className={headCls}>신뢰도</th></tr>
          </thead>
          <tbody>
            {preds.map((p, i) => (
              <tr key={i}><td className={td}>{p.date}</td><td className={td}>{p.direction}</td><td className={td}>{p.change_pct}%</td><td className={td}>{p.confidence}</td></tr>
            ))}
          </tbody>
        </table>
      )}
      {mkt.length > 0 && (
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr><th className={headCls}>일자</th><th className={headCls}>시가</th><th className={headCls}>고가</th><th className={headCls}>저가</th><th className={headCls}>종가</th><th className={headCls}>거래량</th></tr>
          </thead>
          <tbody>
            {mkt.map((m, i) => (
              <tr key={i}><td className={td}>{m.trade_date}</td><td className={td}>{m.open}</td><td className={td}>{m.high}</td><td className={td}>{m.low}</td><td className={td}>{m.close}</td><td className={td}>{m.volume}</td></tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
