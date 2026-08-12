// ── 결제 플랫폼 API (M3 — ZK 지갑/USDC 결제) ─────────────────────────────

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
  signal: string,
  nonce: string
): Promise<{ credentialId: string; verificationLevel: string }> {
  const token = getToken();
  if (!token) throw new Error('로그인이 필요합니다');
  const res = await fetch(`${API_BASE}/wallet/humanity/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ proof, merkleRoot, signal, nonce }),
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error(e.error || e.detail || '인간 증명 검증 실패');
  }
  const d = await res.json();
  return { credentialId: d.credential_id, verificationLevel: d.verification_level };
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
  const response = await fetch(`${API_BASE_URL}/auth/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
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
export async function createPayment(productId: number): Promise<PaymentResponse> {
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
export async function loginWithWallet(ethereum: any, devMode = false): Promise<WalletAuthResponse> {
  let walletAddress: string;
  if (devMode) {
    // 개발 모드: 임의 주소 사용 (백엔드 DEV_SKIP_SIGNATURE=true 필요)
    walletAddress = localStorage.getItem('devWalletAddress') || '0x1111111111111111111111111111111111111111';
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
