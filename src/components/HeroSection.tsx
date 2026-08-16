// ── 히어로 (2026-08 디자인 개편 — 스톡사진 배너 → 데이터 터미널 패널) ─────
// 실제 파이프라인 수치(유니버스/팩터/백테스트/뉴스)를 노출해
// "운영 중인 작업장" 느낌을 준다. 블랙+골드 클리셰 제거, 차콜+브라스+세리프.

function StatRow({ k, v, up }: { k: string; v: string; up?: boolean }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-[#20262c] last:border-0">
      <span className="text-[#a8a29a]">{k}</span>
      <span className={up ? 'text-[#e56b66]' : 'text-[#e8e4dc]'}>{v}</span>
    </div>
  );
}

export function HeroSection() {
  return (
    <section className="panel-dark border-b border-[#262d33]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 lg:py-16 grid lg:grid-cols-[1.15fr_1fr] gap-10 lg:gap-14 items-center">
        <div>
          <p className="eyebrow mb-4">Quant Trader Community</p>
          <h1 className="font-display text-[1.8rem] leading-[1.35] lg:text-[2.4rem] text-[#f5f4f1] font-semibold tracking-tight">
            알고리즘으로 시장을 읽는
            <br />
            사람들의 작업장
          </h1>
          <p className="mt-5 text-[#c2bcb2] text-[15px] leading-relaxed max-w-xl">
            FQT는 퀀트 트레이딩 전략을 만들고, 검증하고, 서로 배우는 공간입니다.
            머신러닝 분석 리포트부터 스크리너, 전략 커뮤니티까지 한 곳에서 다룹니다.
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <a
              href="#products"
              className="px-5 py-2.5 bg-[#a9823a] hover:bg-[#8f6d2c] text-white text-sm font-medium rounded transition-colors"
            >
              분석 서비스 보기
            </a>
            <a
              href="/notices"
              className="px-5 py-2.5 border border-[#3a4149] text-[#cfc9bf] hover:border-[#a9823a] hover:text-white text-sm rounded transition-colors"
            >
              커뮤니티 소식
            </a>
          </div>
        </div>

        <div className="rounded-lg border border-[#262d33] bg-[#0b0f12]/80 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#262d33]">
            <span className="font-terminal text-[11px] text-[#8b857b] tracking-[0.14em]">
              ANALYIST_DD · PIPELINE
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#c8433f] animate-pulse" />
              <span className="font-terminal text-[10px] text-[#c8433f]">LIVE</span>
            </span>
          </div>
          <div className="px-4 py-1 font-terminal text-[13px]">
            <StatRow k="스크리닝 유니버스" v="1,765 종목" up />
            <StatRow k="전략 팩터" v="5종" up />
            <StatRow k="백테스트" v="90일 · 비용 반영" up />
            <StatRow k="뉴스 수집" v="5 소스 · 30분 배치" />
            <StatRow k="결제" v="USDC · Base Sepolia" />
          </div>
        </div>
      </div>
    </section>
  );
}
