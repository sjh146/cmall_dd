# SaaS 구독형 스마트컨트랙트 전환 스펙 (M6)

> 상태: **초안 (2026-08-15)** — 구현 전 단계. M5(일회성 USDC 결제) 안정 운영 중
> 이 문서는 `cmall_dd × blockchain-gateway × analyist_dd` 통합에서
> 일회성 결제 → **구독(subscription)** 확장의 인터페이스/스키마/전환 순서를 정의한다.

---

## 1. 목표

- 고객이 **한 번의 USDC approve**로 주기적 결제가 자동 갱신되는 SaaS 구독
- 반복 결제마다 서명을 요구하지 않는 UX (컨트랙트 pull 방식)
- entitlements에 **만료일** 개념 도입 → 구독 만료 시 분석 기능 자동 차단
- 메인넷 원칙 유지: **모든 결제는 고객 서명/승인 기반** (운영자 키 대납 금지)

## 2. 현재 구조 (M5, 변경 없음)

```
AnalyistPayment (Base Sepolia, 0x50e78A49...):
  registerOrder(orderId, payer, amountUsdc)   ← 운영자/게이트웨이 등록
  pay(orderId, amountUsdc)                     ← 고객 서명 (execute)
  processedOrderIds / orderAmount / orderPayer

게이트웨이: /internal/blockchain/payment/{register,verify,execute,settlement}
cmall_dd: products.crypto_price_usdc (일회성 가격)
entitlement: 결제 이력 1건 이상 + request_type 일치 (만료 개념 없음)
```

## 3. 구독 컨트랙트 인터페이스 (신규 배포)

현재 컨트랙트는 일회성 오더 패턴 → **신규 `SubscriptionManager` 컨트랙트** 배포
(업그레이드보다 신규 배포 + 마이그레이션이 안전. Sepolia 검증 후 메인넷).

```solidity
// ── SubscriptionManager (USDC pull-payment 구독) ─────────────────────
struct Subscription {
    uint256 planId;          // cmall_dd products.id
    address subscriber;      // 고객 지갑
    uint256 amountUsdc;      // 기간당 요금 (6 decimals)
    uint256 intervalSec;     // 갱신 주기 (30d = 2_592_000)
    uint256 startedAt;
    uint256 lastRenewedAt;
    uint256 expiresAt;       // 현재 기간 종료 시각
    uint256 maxPeriods;      // 0 = 무기한
    uint256 periodsPaid;
    bool active;
}

// 고객이 USDC를 컨트랙트에 approve 한 뒤 호출 (1회 서명 = 자동 갱신)
function subscribe(
    uint256 planId,
    uint256 amountUsdc,
    uint256 intervalSec,
    uint256 maxPeriods
) external;

// approve 기반 자동 인출 — 누구나 호출 가능하나 잔액/allowance 부족 시 revert
function renew(uint256 subscriptionId) external;

function cancel(uint256 subscriptionId) external;  // 본인만

function getSubscription(uint256 subscriptionId)
    external view returns (Subscription memory);
function isActive(uint256 subscriptionId) external view returns (bool);
```

**동작 원리 (pull-payment):**
1. 고객: `USDC.approve(SubscriptionManager, MAX_UINT)` — 1회 서명
2. `subscribe()` — 첫 기간 요금 즉시 인출, expiresAt = now + interval
3. 만료 전 (게이트웨이 스케줄러가) `renew()` — 잔액/allowance 있으면 인출 + 갱신,
   없으면 `active=false` (서비스 차단)
4. `cancel()` — 이후 갱신 중단 (현재 기간은 만료까지 유지)

**리스크:** 고객이 MAX_UINT approve 후 잔액 부족 시 renew가 revert —
게이트웨이는 만료 임박 감지 시 알림 (이메일/디스코드) + 재시도 로직.

## 4. DB 스키마 변경 (cmall_dd postgres)

### products (기존 테이블 확장)
```sql
ALTER TABLE products ADD COLUMN IF NOT EXISTS
    billing_interval_days INT,        -- NULL = 일회성 / 30 = 월간 구독
    trial_days INT DEFAULT 0,
    subscription_contract_id BIGINT;  -- 구독 컨트랙트 subscriptionId (활성 구독)
```

### subscriptions (신규)
```sql
CREATE TABLE IF NOT EXISTS subscriptions (
    id BIGSERIAL PRIMARY KEY,
    product_id INT NOT NULL REFERENCES products(id),
    user_id INT NOT NULL REFERENCES users(id),
    wallet_address TEXT NOT NULL,
    contract_subscription_id BIGINT,     -- 온체인 ID (성사 후)
    status TEXT NOT NULL DEFAULT 'pending',  -- pending/active/expired/cancelled
    amount_usdc BIGINT NOT NULL,
    interval_days INT NOT NULL,
    current_period_start TIMESTAMPTZ,
    current_period_end TIMESTAMPTZ,      -- entitlements 만료 기준
    periods_paid INT DEFAULT 0,
    auto_renew BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE (product_id, user_id)
);
```

### entitlement 검사 변경 (핵심 — 분석.go)
```go
// 기존: 결제 이력 1건 + request_type 일치
// 변경: 구독이면 current_period_end > now() 인지 검사 (만료 시 402/403)
func userHasAnalysisEntitlement(db, userID, requestType) bool {
    if isSubscription(product) {
        return subscriptionIsActive(db, userID, productID, now())
    }
    return hasPaidOrder(db, userID, requestType)  // M5 경로 유지
}
```

## 5. 게이트웨이 API (신규)

```
POST /internal/subscription/create   {product_id, wallet_address, interval_days, amount_usdc}
                                     → {subscription_id, approve_target, approve_amount}
POST /internal/subscription/activate {subscription_id, contract_subscription_id}
POST /internal/subscription/renew    {contract_subscription_id}   ← 스케줄러
POST /internal/subscription/cancel   {contract_subscription_id}
GET  /internal/subscription/:id      → 상태/만료일
```
인증: `X-Internal-Api-Key` (기존 패턴 그대로). 온체인 호출은
`SubscriptionManager` ABI로 교체 (기존 `ANALYIST_PAYMENT_ABI`와 병행 — 일회성 유지).

## 6. cmall_dd 프론트

- 상품 카드/상세: 구독 상품이면 "월 $X · 자동 갱신" 표시
- 결제 박스(AnalysisPurchase): 구독이면 approve + subscribe 흐름
  (월렛 서명 1회 → "구독 시작")
- 마이페이지: 구독 상태/다음 갱신일/취소 버튼

## 7. 전환 순서 (하이브리드, 단계적)

| 단계 | 내용 | 검증 |
|---|---|---|
| 0 (지금) | M5 일회성 유지 — 운영 안정 | — |
| 1 | 스펙 확정 + `SubscriptionManager` 개발 (Hardhat+viem, 테스트) | 컨트랙트 테스트 |
| 2 | Sepolia 배포 + 게이트웨이 subscription API | registerOrder 병행 검증 |
| 3 | cmall_dd 스키마 + entitlement 만료 검사 + 구독 상품 시드 | 스크린샷 QA |
| 4 | 프론트 구독 UI (결제 박스/마이페이지) | E2E |
| 5 | 갱신 스케줄러 + 만료 알림 (디스코드/이메일) | 30일 시뮬 |
| 6 | 메인넷 배포 (고객 서명 원칙 — 운영자 키 대납 금지) | 메인넷 카나리 |

## 8. 보안/리스크 체크리스트

- [ ] 고객 approve는 **한도 지정 가능** (MAX_UINT 대신 기간당 × 몇 회 상한) — UX/보안 트레이드오프
- [ ] `renew()`는 잔액 부족 시 revert — **재시도 + 알림** 필수 (구독 끊김 방지)
- [ ] cancel은 subscriber 본인만 (CWE-284)
- [ ] subscriptionId → (user, product) 바인딩 검증 (CWE-862 — 다른 구독으로 분석 요청 불가)
- [ ] 만료 직후 entitlements 즉시 차단 (서버 시각 기준 — 온체인 expiresAt과 병행)
- [ ] 운영자 키는 **테스트넷 전용** — 메인넷은 HSM/멀티시그 (config.ts 주석 참고)
- [ ] ZK Smart Wallet 세션키 연동 시: 세션키로 approve/renew 서명 위임 (M2와 합류)

## 9. 향후 확장

- **ZK Smart Wallet + 세션키**: 완전 자동 갱신 (서명 0회)
- **월렛리스 구독**: paymaster + walletless-payment 패턴 (분석가스 대납)
- **티어 구독**: planId별 기능 차등 (request_type allowlist 확장)
- **환불/중단**: prorate 계산 (일회성과 별개 정책 필요)
