/**
 * walletProviders — 지갑 연결 추상화 레이어 (2026-08-13)
 *
 * MetaMask 없이 결제 가능하도록 3가지 경로를 통합한다:
 *  1. injected  — MetaMask 등 브라우저 확장 (window.ethereum)
 *  2. appkit    — Reown AppKit: WalletConnect QR(모바일 지갑) + 이메일/소셜 임베디드 지갑
 *  3. address   — (dev 전용) 주소 직접 입력 → 운영자 대행 결제
 *
 * AppKit은 VITE_WALLETCONNECT_PROJECT_ID가 설정된 경우에만 활성화된다.
 * 키가 없으면 버튼이 숨겨지고(그레이스풀 폴백) 나머지 경로는 그대로 동작한다.
 */
import { createAppKit, type AppKit } from '@reown/appkit';
import { EthersAdapter } from '@reown/appkit-adapter-ethers';
import { baseSepolia, base } from '@reown/appkit/networks';

const PROJECT_ID: string = (import.meta.env.VITE_WALLETCONNECT_PROJECT_ID as string) || '';
export const WALLETCONNECT_CONFIGURED = !!PROJECT_ID;

const CHAIN_ID: string = (import.meta.env.VITE_CHAIN_ID as string) || '84532';

type WalletProviderKind = 'injected' | 'appkit' | 'address';

const KIND_KEY = 'walletProviderKind';

export function setWalletProviderKind(kind: WalletProviderKind) {
  localStorage.setItem(KIND_KEY, kind);
}
export function getWalletProviderKind(): WalletProviderKind | null {
  return (localStorage.getItem(KIND_KEY) as WalletProviderKind) || null;
}
export function clearWalletProviderKind() {
  localStorage.removeItem(KIND_KEY);
}

let appKit: AppKit | null = null;
let appKitError: string | null = null;

/** AppKit 싱글턴 (projectId 없으면 null — 그레이스풀 폴백) */
export function getAppKit(): AppKit | null {
  if (appKit) return appKit;
  if (!PROJECT_ID) {
    appKitError = 'VITE_WALLETCONNECT_PROJECT_ID 미설정 (Reown Cloud에서 발급)';
    return null;
  }
  try {
    const mainnet = CHAIN_ID === '8453';
    appKit = createAppKit({
      projectId: PROJECT_ID,
      adapters: [new EthersAdapter()],
      networks: mainnet ? [base] : [baseSepolia],
      defaultNetwork: mainnet ? base : baseSepolia,
      features: {
        // 이메일/소셜 = 임베디드 지갑 (AppKit Auth) — MetaMask 없는 고객용
        email: true,
        socials: ['google', 'x', 'discord', 'github'],
        swaps: false,
        onramp: false, // M2에서 카드 온램프 활성화 예정
        send: false,
        receive: false,
        history: false,
      },
      themeMode: 'dark',
    });
  } catch (e: any) {
    appKitError = e?.message || 'AppKit 초기화 실패';
    return null;
  }
  return appKit;
}

export function getAppKitError(): string | null {
  return appKitError;
}

/**
 * AppKit 모달로 연결 (WalletConnect QR / 이메일 / 소셜).
 * 모달에서 연결이 완료되면 { provider(EIP-1193), address } 반환.
 */
export async function connectWithAppKit(): Promise<{ provider: any; address: string }> {
  const kit = getAppKit();
  if (!kit) throw new Error(getAppKitError() || 'WalletConnect 미설정');

  // 이미 연결된 세션이 있으면 즉시 반환
  const existingProvider = kit.getWalletProvider();
  const existingAddress = kit.getAddress();
  if (existingProvider && existingAddress) {
    return { provider: existingProvider, address: existingAddress };
  }

  // 연결 대기 (모달 오픈 + 사용자 액션)
  const connected = new Promise<{ provider: any; address: string }>((resolve, reject) => {
    const timeout = setTimeout(() => {
      unsub();
      reject(new Error('지갑 연결 시간 초과'));
    }, 180_000);
    const unsub = kit.subscribeAccount(() => {
      const provider = kit.getWalletProvider();
      const address = kit.getAddress();
      if (provider && address) {
        clearTimeout(timeout);
        unsub();
        resolve({ provider, address });
      }
    });
  });

  await kit.open();
  return connected;
}

/**
 * 현재 활성 프로바이저를 반환 (결제/서명에 사용).
 * 1) 주입형(MetaMask) → 2) AppKit(이메일/소셜/모바일 — 세션 복원) 순서.
 */
export async function getActiveProvider(): Promise<{ provider: any; address: string } | null> {
  // 1) MetaMask 등 주입형
  const ethereum = (window as any).ethereum;
  if (ethereum) {
    const accounts = await ethereum.request({ method: 'eth_accounts' }).catch(() => []);
    if (accounts?.[0]) return { provider: ethereum, address: accounts[0] };
  }
  // 2) AppKit 세션 (이메일/소셜 로그인 + WalletConnect)
  const kit = getAppKit();
  if (kit) {
    const provider = kit.getWalletProvider();
    const address = kit.getAddress();
    if (provider && address) return { provider, address };
  }
  return null;
}
