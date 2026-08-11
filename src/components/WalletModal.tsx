import { useState } from 'react';
import {
  loginWithWallet,
  getWalletAddress,
} from '../lib/paymentApi';
import { logout, getToken, removeToken, removeCurrentUser } from '../lib/api';

/**
 * WalletModal — ZK 지갑 연결/해제 UI (M3)
 * - 실제 지갑(MetaMask) 또는 개발 모드(devMode) 지원
 * - 연결 상태를 localStorage에 유지
 */
export default function WalletModal({ devMode = false }: { devMode?: boolean }) {
  const [address, setAddress] = useState<string | null>(getWalletAddress());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ethereum = (window as any).ethereum;

  async function handleConnect() {
    setLoading(true);
    setError(null);
    try {
      if (!devMode && !ethereum) {
        throw new Error('MetaMask가 설치되어 있지 않습니다. (개발 모드는 devMode)');
      }
      const auth = await loginWithWallet(ethereum, devMode);
      setAddress(auth.walletAddress);
    } catch (e: any) {
      setError(e.message || '지갑 연결 실패');
    } finally {
      setLoading(false);
    }
  }

  function handleLogout() {
    logout();
    removeWalletAddress();
    setAddress(null);
  }

  if (!getToken()) {
    return (
      <div className="p-4 border rounded-lg bg-gray-50">
        <p className="text-sm text-gray-600 mb-2">지갑 결제를 사용하려면 먼저 로그인이 필요합니다.</p>
        <a href="/auth" className="text-blue-600 underline text-sm">로그인/회원가입</a>
      </div>
    );
  }

  if (address) {
    return (
      <div className="p-4 border rounded-lg bg-green-50">
        <p className="text-sm font-medium">✅ 지갑 연결됨</p>
        <p className="text-xs text-gray-600 break-all mb-2">{address}</p>
        <button
          onClick={handleLogout}
          className="text-xs text-red-600 underline"
        >
          연결 해제
        </button>
      </div>
    );
  }

  return (
    <div className="p-4 border rounded-lg bg-gray-50">
      <p className="text-sm text-gray-600 mb-2">
        지갑을 연결하고 USDC로 결제하세요. 시크릿은 서버에 저장되지 않습니다.
      </p>
      <button
        onClick={handleConnect}
        disabled={loading}
        className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm disabled:opacity-50"
      >
        {loading ? '연결 중...' : devMode ? '개발모드 지갑 연결' : 'MetaMask 지갑 연결'}
      </button>
      {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
    </div>
  );
}
