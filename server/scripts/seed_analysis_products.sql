-- M6: AI 분석 상품 4종 시드 (재구축/새 환경에서 자동 적용 가능)
-- 멱등: ON CONFLICT (id) DO NOTHING — 기존 행은 건드리지 않음.
-- 적용: docker exec cmall_dd-postgres psql -U postgres -d postgres -f <이 파일>
--       (또는 컨테이너 init 스크립트에 포함)
INSERT INTO products
  (id, seller_id, name, price, original_price, image, category, product_type,
   request_type, version, download_url, file_size, license_key, description,
   features, system_requirements, crypto_price_usdc)
VALUES
  (179, 212, 'AI 주식 분석 리포트 (analyist_dd)', 500, 0, '', 'AI 분석', 'software',
   'stock_report', '1.0.0', '', 0, '',
   'KRX 종목 분석 리포트 — ML 예측/감성/시세 합성 (USDC 결제)', '', '', 5000000),
  (180, 212, '스윙종목 스크리너 (analyist_dd)', 90, 0, '', 'AI 분석', 'software',
   'swing_screener', '1.0.0', '', 0, '',
   '전 종목 스윙 스크리닝 리포트 — ML 예측/신뢰도 (USDC 결제)', '', '', 900000),
  -- 181 (모델 백테스트 리포트) — 2026-08-15 사용자 요청으로 상품 삭제
  (182, 212, '강환국 투자팩터 5종 리포트', 90, 0, '', 'AI 분석', 'software',
   'factor_report', '1.0.0', '', 0, '',
   '강환국『하면 된다! 퀀트투자』팩터 전략 5종 결과 (USDC 결제)', '', '', 900000)
ON CONFLICT (id) DO NOTHING;
