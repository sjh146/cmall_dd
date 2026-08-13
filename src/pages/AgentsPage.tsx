import { useEffect, useState } from 'react';
import { getAgents, type Agent } from '../lib/paymentApi';
import AnalysisPurchase from '../components/AnalysisPurchase';
import WalletModal from '../components/WalletModal';

/**
 * AgentsPage — AI 분석 에이전트 상품 목록 (M3/M6)
 * 결제+분석 흐름은 공용 컴포넌트 AnalysisPurchase 사용 (FQT 쇼핑몰 통합형).
 * 라우트는 / → 쇼핑몰로 통합되어 있으나, 직접 접근 시에도 동작하도록 유지.
 */
export default function AgentsPage({ devMode }: { devMode?: boolean }) {
  const [agents, setAgents] = useState<Agent[]>([]);

  const isDevMode = devMode ?? (typeof window === 'undefined' ? true : !(window as any).ethereum);

  useEffect(() => {
    getAgents().then(setAgents).catch(() => setAgents([]));
  }, []);

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-1 text-[#fafafa]">AI 분석 에이전트</h1>
      <p className="text-sm text-[#737373] mb-6">
        analyist_dd 엔진 기반 주식 분석 리포트를 USDC(Base L2)로 결제하고 받아보세요.
      </p>

      <WalletModal devMode={isDevMode} />

      <div className="grid md:grid-cols-2 gap-4 mt-6">
        {agents.map((agent) => (
          <AnalysisPurchase key={agent.id} agent={agent} />
        ))}
        {agents.length === 0 && (
          <p className="text-sm text-[#737373] col-span-2">
            판매 중인 분석 상품이 없습니다.
          </p>
        )}
      </div>
    </div>
  );
}
