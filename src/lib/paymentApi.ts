// ── 결제 플랫폼 API (M3 — ZK 지갑/USDC 결제) ─────────────────────────────
// ⚠️ 이 파일은 api.ts의 함수/상수를 그대로 사용한다 — import 누락 시
// 프로덕션 번들에서 ReferenceError로 모든 결제/분석 API가 실패한다 (실측 2026-08-13).
import { API_BASE_URL, getToken, setToken, setCurrentUser, type User } from './api';

// World ID/인간증명 등 일부 호출에서 사용하는 별칭 (api.ts의 API_BASE_URL과 동일)
const API_BASE = API_BASE_URL;

// Types
export interface NonceResponse {
  nonce: string;
  message: string;
  expiresIn: number;
}

export interface WalletAuthResponse {
  token: string;
  walletAddress: string;
  user: User;
}

export interface Payment {
  id: number;
  userId: number;
  orderId: number;
  referenceId: string;
  walletAddress: string;
  amountUsdc: number;
  status: 'pending' | 'paid' | 'failed';
  txHash?: string;
  chainId: number;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentResponse {
  payment: Payment;
  contractAddress?: string;
  tokenAddress?: string;
  verifyError?: string;
}

/**
 * payments/create 응답 — Go PaymentResponse가 Payment를 익명 임베딩해
 * JSON이 flat으로 내려온다: 결제 필드 + contractAddress + tokenAddress(설정 시).
 */
export type CreatePaymentResult = Payment & {
  contractAddress?: string;
  tokenAddress?: string;
};

export interface AnalysisRequest {
  id: number;
  userId: number;
  requestType: string;
  symbol: string;
  status: 'queued' | 'running' | 'done' | 'failed';
  resultJson?: string;
  internalRequestId?: string;
  error?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Agent {
  id: number;
  name: string;
  description: string;
  category: string;
  productType: string;
  requestType?: string;
  cryptoPriceUsdc: number;
}

// 지갑 세션 (localStorage)
export function getWalletAddress(): string | null {
  return localStorage.getItem('walletAddress');
}

/** World ID 공개 설정 조회 (M2-1) — {enabled, app_id, action_id} */
export async function fetchWorldIDConfig(): Promise<{ enabled: boolean; app_id?: string; action_id?: string }> {
  const res = await fetch(`${API_BASE}/config/worldid`);
  if (!res.ok) return { enabled: false };
  return res.json();
}

/** World ID 인간 증명 nonce 발급 (JWT) — {nonce, action_id, expires_at} */
export async function humanityNonce(): Promise<{ nonce: string; actionId: string; expiresAt: string }> {
  const token = getToken();
  const wallet = getWalletAddress();
  if (!token || !wallet) throw new Error('로그인과 지갑 연결이 필요합니다');
  const res = await fetch(`${API_BASE}/wallet/humanity/nonce`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ walletAddress: wallet }),
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error(e.error || 'nonce 발급 실패');
  }
  const d = await res.json();
  return { nonce: d.nonce, actionId: d.action_id, expiresAt: d.expires_at };
}

/** World ID 인간 증명 검증 (JWT) — {credential_id, verification_level} */
export async function humanityVerify(
  proof: string,
  merkleRoot: string,
  nullifierHash: string,
  verificationLevel: string,
  signal: string,
  nonce: string
): Promise<{ credentialId: string; verificationLevel: string }> {
  const token = getToken();
  if (!token) throw new Error('로그인이 필요합니다');
  const res = await fetch(`${API_BASE}/wallet/humanity/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ proof, merkleRoot, nullifierHash, verificationLevel, signal, nonce }),
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error(e.error || e.detail || '인간 증명 검증 실패');
  }
  const d = await res.json();
  return { credentialId: d.credential_id, verificationLevel: d.verification_level };
}

/** ZKPassport 속성 증명 검증 (JWT, M2-2) — {verified, attributes} */
export async function zkpassportVerify(payload: {
  proofs: unknown;
  originalQuery: unknown;
  queryResult: unknown;
  validity?: unknown;
}): Promise<{ verified: boolean; credentialId?: string; attributes?: unknown }> {
  const token = getToken();
  if (!token) throw new Error('로그인이 필요합니다');
  const res = await fetch(`${API_BASE}/wallet/zkpassport`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error(e.error || e.detail || '속성 증명 검증 실패');
  }
  return res.json();
}

export function setWalletAddress(address: string): void {
  localStorage.setItem('walletAddress', address);
}

export function removeWalletAddress(): void {
  localStorage.removeItem('walletAddress');
}

// 지갑 인증
export async function getNonce(walletAddress: string): Promise<NonceResponse> {
  const response = await fetch(`${API_BASE_URL}/auth/nonce`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ walletAddress }),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to get nonce');
  }
  return response.json();
}

export async function verifyWallet(
  walletAddress: string,
  signature: string,
  nonce: string
): Promise<WalletAuthResponse> {
  // 로그인 상태면 토큰을 함께 전송 → 백엔드가 현재 계정에 지갑을 바인딩
  // (2026-08-13: 지갑 전용 계정 분리 방지 — 구매 내역이 로그인 계정에 쌓임)
  const token = getToken();
  const response = await fetch(`${API_BASE_URL}/auth/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ walletAddress, signature, nonce }),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to verify wallet');
  }
  return response.json();
}

// 지갑 연결 상태 (JWT)
export async function connectWallet(): Promise<{ connected: boolean; walletAddress?: string }> {
  const token = getToken();
  const response = await fetch(`${API_BASE_URL}/wallet/connect`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to connect wallet');
  }
  return response.json();
}

// 결제
export async function createPayment(productId: number): Promise<CreatePaymentResult> {
  const token = getToken();
  const response = await fetch(`${API_BASE_URL}/payments/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ productId }),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create payment');
  }
  return response.json();
}

/** 운영자 대행 결제 주문 생성 (MetaMask 없는 주소 연결 사용자 — dev 전용) */
export async function createPaymentDev(productId: number): Promise<CreatePaymentResult> {
  const token = getToken();
  const response = await fetch(`${API_BASE_URL}/payments/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ productId, payerMode: 'operator' }),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create payment');
  }
  return response.json();
}

/** 운영자 대행 결제 실행 (dev 전용 — approve+pay를 운영자 키로 대신 수행) */
export async function devPay(referenceId: string): Promise<{ ok: boolean; txHash?: string }> {
  const token = getToken();
  const response = await fetch(`${API_BASE_URL}/payments/${referenceId}/dev-pay`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.error || 'dev-pay failed');
  }
  return response.json();
}

export async function getPayment(referenceId: string): Promise<PaymentResponse> {
  const token = getToken();
  const response = await fetch(`${API_BASE_URL}/payments/${referenceId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to get payment');
  }
  return response.json();
}

/** 내 구매 내역 (paid 결제 + 분석 결과) — My Products 페이지 */
export interface PurchaseItem {
  referenceId: string;
  walletAddress: string;
  amountUsdc: number;
  status: string;
  txHash: string;
  purchasedAt: string;
  productId: number;
  productName: string;
  requestType: string;
  analysisId: number;
  analysisStatus: string;
  resultJson: string;
  analysisUpdated: string;
}

export async function fetchMyPurchases(): Promise<PurchaseItem[]> {
  const token = getToken();
  const response = await fetch(`${API_BASE_URL}/my-purchases`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.error || 'Failed to load purchases');
  }
  const data = await response.json();
  return data.purchases || [];
}

// 분석
export async function createAnalysis(symbol: string, requestType: string): Promise<AnalysisRequest> {
  const token = getToken();
  const response = await fetch(`${API_BASE_URL}/analysis`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ symbol, requestType }),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create analysis');
  }
  return response.json();
}

export async function getAnalysis(requestId: number): Promise<AnalysisRequest> {
  const token = getToken();
  const response = await fetch(`${API_BASE_URL}/analysis/${requestId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to get analysis');
  }
  return response.json();
}

// AI 에이전트 상품 목록
export async function getAgents(): Promise<Agent[]> {
  const response = await fetch(`${API_BASE_URL}/agents`);
  if (!response.ok) {
    throw new Error('Failed to get agents');
  }
  const data = await response.json();
  return data.agents || [];
}

/**
 * MetaMask 지갑 로그인 (EIP-191 personal_sign)
 * - nonce 발급 → 지갑 서명 → verify → JWT 저장
 * - DEV_SKIP_SIGNATURE 모드: 시그니처 "0xdev" 사용 (백엔드 dev 설정 시)
 */
export async function loginWithWallet(ethereum: any, devMode = false, explicitAddress?: string): Promise<WalletAuthResponse> {
  let walletAddress: string;
  if (devMode) {
    // 개발 모드/주소 직접 입력: 백엔드가 DEV_SKIP_SIGNATURE를 명시적으로 활성화한 경우에만 유효.
    // explicitAddress(지갑 주소 직접 입력) 우선, 없으면 localStorage devWalletAddress 사용.
    walletAddress = explicitAddress || localStorage.getItem('devWalletAddress') || '';
    if (!walletAddress) {
      throw new Error('지갑 주소를 입력하세요');
    }
  } else {
    const accounts = await ethereum.request({ method: 'eth_requestAccounts' });
    walletAddress = accounts[0];
  }

  const { nonce, message } = await getNonce(walletAddress);

  let signature: string;
  if (devMode) {
    signature = '0xdev';
  } else {
    signature = await ethereum.request({
      method: 'personal_sign',
      params: [message, walletAddress],
    });
  }

  const auth = await verifyWallet(walletAddress, signature, nonce);
  setToken(auth.token);
  setCurrentUser(auth.user);
  setWalletAddress(auth.walletAddress);
  return auth;
}

// ── 온체인 스마트컨트랙트 결제 (M6) ───────────────────────────────────────
// payments/create(registerOrder) → 네트워크 스위치(84532) → USDC approve → pay() → getPayment 폴링

/** Base Sepolia 체인 ID (10진수/16진수) */
export const BASE_SEPOLIA_CHAIN_ID = 84532;
const BASE_SEPOLIA_CHAIN_ID_HEX = '0x14a34';

/**
 * 테스트넷 USDC 폴백 주소 (공개 주소 — 시크릿 아님).
 * payments/create 응답의 tokenAddress 필드를 우선 사용하고, 백엔드가
 * USDC_TOKEN_ADDRESS를 주입하지 않아 필드가 비어 있는 경우에만 사용한다.
 */
export const USDC_TOKEN_ADDRESS_FALLBACK = '0x036CbD53842c5426634e7929541eC2318f3dCF7e';

const USDC_ABI = [
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
] as const;

const ANALYIST_PAYMENT_ABI = [
  'function pay(uint256 orderId, uint256 amountUsdc)',
  'function processedOrderIds(uint256 orderId) view returns (bool)',
] as const;

// ── M6: SubscriptionManager ABI ─────────────────────────────────────────
const SUBSCRIPTION_ABI = [
  'function subscribe(uint256 planId, uint256 amountUsdc, uint256 intervalSec, uint256 maxPeriods) returns (uint256 subscriptionId)',
  'function getActiveSubscriptionId(address subscriber, uint256 planId) view returns (uint256)',
  'function isActive(uint256 subscriptionId) view returns (bool)',
  'function subscriptions(uint256) view returns (uint256 planId, address subscriber, uint256 amountUsdc, uint256 intervalSec, uint256 startedAt, uint256 lastRenewedAt, uint256 expiresAt, uint256 maxPeriods, uint256 periodsPaid, bool active)',
] as const;

export interface SubscriptionIntent {
  contract: string;
  usdc: string;
  planId: string;
  amountUsdc: string;
  intervalSec: string;
  approveAmount: string;
}

export interface ActiveSubscription {
  active: boolean;
  subscriptionId?: string;
  expiresAt?: string;
  amountUsdc?: string;
  intervalSec?: string;
  periodsPaid?: string;
}

/** 구독 의도 조회 (백엔드 → 게이트웨이 프록시) */
export async function getSubscriptionIntent(productId: number): Promise<SubscriptionIntent> {
  const response = await fetch(`${API_BASE_URL}/subscriptions/intent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}) },
    body: JSON.stringify({ productId }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error((err as any).error || '구독 의도 조회 실패');
  }
  return response.json();
}

/** 온체인 활성 구독 조회 */
export async function getActiveSubscription(
  walletAddress: string,
  productId: number
): Promise<ActiveSubscription> {
  const response = await fetch(
    `${API_BASE_URL}/subscriptions/active?walletAddress=${encodeURIComponent(walletAddress)}&productId=${productId}`,
    { headers: { Authorization: `Bearer ${getToken()}` } }
  );
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error((err as any).error || '구독 상태 조회 실패');
  }
  return response.json();
}

/** 지갑에서 approve(USDC) + subscribe() 실행 — 1회 서명 = 자동 갱신 */
export async function subscribeWithContract(
  intent: SubscriptionIntent,
  ethereum: any
): Promise<{ txHash: string; subscriptionId: string }> {
  await ensureBaseSepolia(ethereum);

  const { BrowserProvider, Contract } = await import('ethers');
  const provider = new BrowserProvider(ethereum);
  const signer = await provider.getSigner();

  const usdc = new Contract(intent.usdc, USDC_ABI, signer);
  const subContract = new Contract(intent.contract, SUBSCRIPTION_ABI, signer);

  // ① USDC approve (잔여 allowance 부족 시에만) — subscribe() 인출 선행 필수
  const allowance = await usdc.allowance(await signer.getAddress(), intent.contract);
  if (allowance < BigInt(intent.approveAmount)) {
    const approveTx = await usdc.approve(intent.contract, BigInt(intent.approveAmount));
    await approveTx.wait();
  }

  // ② subscribe(planId, amountUsdc, intervalSec, maxPeriods=0 무기한)
  const tx = await subContract.subscribe(
    BigInt(intent.planId),
    BigInt(intent.amountUsdc),
    BigInt(intent.intervalSec),
    0n
  );
  const receipt = await tx.wait();

  // ③ Subscribed 이벤트에서 subscriptionId 추출
  let subscriptionId = '';
  for (const log of receipt.logs || []) {
    if (log.topics && log.topics.length >= 3 && log.address.toLowerCase() === intent.contract.toLowerCase()) {
      const candidate = log.topics[2] ? BigInt(log.topics[2]).toString() : '';
      if (candidate) subscriptionId = candidate;
      break;
    }
  }
  if (!subscriptionId) {
    // 이벤트 파싱 실패 시 컨트랙트 조회로 폴백
    subscriptionId = (
      await subContract.getActiveSubscriptionId(await signer.getAddress(), BigInt(intent.planId))
    ).toString();
  }
  return { txHash: receipt.hash, subscriptionId };
}

/** 구독 기록 (DB — entitlements용) */
export async function recordSubscription(
  productId: number,
  walletAddress: string,
  contractSubscriptionId: string,
  periodEnd: string
): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/subscriptions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
    body: JSON.stringify({ productId, walletAddress, contractSubscriptionId, periodEnd }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error((err as any).error || '구독 기록 실패');
  }
}

/**
 * 사용자 지갑을 Base Sepolia(84532)로 전환 (미등록 체인이면 추가 후 전환).
 */
export async function ensureBaseSepolia(ethereum: any): Promise<void> {
  const current = await ethereum.request({ method: 'eth_chainId' });
  if (Number(current) === BASE_SEPOLIA_CHAIN_ID) return;
  try {
    await ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: BASE_SEPOLIA_CHAIN_ID_HEX }],
    });
  } catch (e: any) {
    // 4902 = chain not added to wallet → 추가 후 재시도
    if (e?.code === 4902) {
      await ethereum.request({
        method: 'wallet_addEthereumChain',
        params: [
          {
            chainId: BASE_SEPOLIA_CHAIN_ID_HEX,
            chainName: 'Base Sepolia',
            nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
            rpcUrls: ['https://sepolia.base.org'],
            blockExplorerUrls: ['https://sepolia.basescan.org'],
          },
        ],
      });
    } else {
      throw e;
    }
  }
}

/**
 * 스마트컨트랙트 직접 결제 (M6 — G1 해소)
 * 1) 네트워크 스위치 (Base Sepolia 84532)
 * 2) USDC approve(contractAddress, amountUsdc) — 잔여 allowance가 충분하면 생략
 * 3) AnalyistPayment.pay(orderId, amountUsdc) — orderId = BigInt(keccak256(utf8(referenceId)))
 * 4) 온체인 tx 확정 후 txHash 반환 (getPayment 폴링은 호출부에서 진행)
 *
 * @param payment payments/create 응답의 payment (referenceId/amountUsdc/walletAddress 사용)
 * @param contractAddress payments/create 응답의 contractAddress (AnalyistPayment)
 * @param tokenAddress payments/create 응답의 tokenAddress (USDC) — 비어 있으면 테스트넷 폴백
 * @param ethereum EIP-1193 provider (window.ethereum)
 * @returns {txHash, approveTxHash} pay() 트랜잭션 해시 + approve 트랜잭션 해시(생략 시 undefined)
 */
export async function payWithContract(
  payment: Payment,
  contractAddress: string,
  tokenAddress: string | null | undefined,
  ethereum: any
): Promise<{ txHash: string; approveTxHash?: string }> {
  if (!contractAddress) throw new Error('payments/create 응답에 contractAddress가 없습니다.');
  const usdcAddress = tokenAddress || USDC_TOKEN_ADDRESS_FALLBACK;

  await ensureBaseSepolia(ethereum);

  const { BrowserProvider, Contract, keccak256, toUtf8Bytes } = await import('ethers');
  const provider = new BrowserProvider(ethereum);
  const signer = await provider.getSigner();
  const address = (await signer.getAddress()).toLowerCase();

  // 결제자 바인딩: pay()는 등록된 payer(msg.sender)만 호출 가능 — 지갑 불일치 사전 차단
  if (address !== payment.walletAddress.toLowerCase()) {
    throw new Error(
      `지갑 불일치: 이 결제는 ${payment.walletAddress} 지갑으로 생성됐습니다. 현재 연결 지갑(${address})으로 결제할 수 없습니다.`
    );
  }

  const amount = BigInt(payment.amountUsdc);
  const orderId = BigInt(keccak256(toUtf8Bytes(payment.referenceId)));

  const usdc = new Contract(usdcAddress, USDC_ABI, signer);
  const paymentContract = new Contract(contractAddress, ANALYIST_PAYMENT_ABI, signer);

  // ② USDC approve (잔여 allowance 부족 시에만) — pay() 선행 필수
  const allowance = await usdc.allowance(address, contractAddress);
  let approveTxHash: string | undefined;
  if (allowance < amount) {
    const approveTx = await usdc.approve(contractAddress, amount);
    approveTxHash = approveTx.hash;
    await approveTx.wait();
  }

  // ③ pay(orderId, amountUsdc)
  // Base 공개 RPC는 approve 직후 estimateGas가 stale state를 볼 수 있어
  // allowance 재확인 + 재-approve 후 재시도한다 (최대 3회).
  let payTx: { hash: string; wait(): Promise<unknown> } | undefined;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      payTx = await paymentContract.pay(orderId, amount);
      break;
    } catch (e) {
      if (attempt === 3) throw e;
      const cur = await usdc.allowance(address, contractAddress);
      if (cur < amount) {
        const reApprove = await usdc.approve(contractAddress, amount);
        await reApprove.wait();
      }
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
  await payTx.wait();

  return { txHash: payTx.hash, approveTxHash };
}

/**
 * getPayment 폴링 — 결제가 paid(또는 failed)로 확정될 때까지 반복 조회.
 * @returns 최종 paid Payment (onStatus 콜백으로 매 폴링 상태 전달)
 */
export async function pollPaymentUntilPaid(
  referenceId: string,
  opts?: { intervalMs?: number; timeoutMs?: number; onStatus?: (status: string) => void }
): Promise<Payment> {
  const intervalMs = opts?.intervalMs ?? 3000;
  const timeoutMs = opts?.timeoutMs ?? 180_000;
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const resp = await getPayment(referenceId);
    const status = resp.payment.status;
    opts?.onStatus?.(status);
    if (status === 'paid') return resp.payment;
    if (status === 'failed') throw new Error('결제가 실패 상태로 확정되었습니다.');
    if (resp.verifyError) {
      opts?.onStatus?.(`gateway: ${resp.verifyError}`);
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error('결제 확인 시간 초과 — 결제 상태를 다시 확인해주세요.');
}

/**
 * 분석 잡 폴링 — queued/running → done/failed 확정까지 반복 조회 (M6 비동기 잡).
 * @returns 최종 AnalysisRequest (resultJson 포함, onStatus 콜백으로 진행 상태 전달)
 */
export async function pollAnalysisUntilDone(
  requestId: number,
  opts?: { intervalMs?: number; timeoutMs?: number; onStatus?: (status: string) => void }
): Promise<AnalysisRequest> {
  const intervalMs = opts?.intervalMs ?? 5000;
  const timeoutMs = opts?.timeoutMs ?? 25 * 60_000; // 전략 실행 최대 25분 (스윙/팩터 잡)
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const rec = await getAnalysis(requestId);
    opts?.onStatus?.(rec.status);
    if (rec.status === 'done' || rec.status === 'failed') return rec;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error('분석 실행 시간 초과 — 잠시 후 결과를 다시 조회해주세요.');
}
