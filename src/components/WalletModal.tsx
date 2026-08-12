import { useEffect, useState } from 'react';
import { IDKitWidget, VerificationLevel, type ISuccessResult } from '@worldcoin/idkit';
import {
  loginWithWallet,
  getWalletAddress,
  fetchWorldIDConfig,
  humanityNonce,
  humanityVerify,
} from '../lib/paymentApi';
import { logout, getToken, removeToken, removeCurrentUser } from '../lib/api';

/**
 * WalletModal — ZK 지갑 연결/해제 UI (M3) + 인간 증명 (M2-1)
 * - 실제 지갑(MetaMask) 또는 개발 모드(devMode) 지원
 * - World ID 인간 증명: devMode는 로컬 모의, 실모드는 IDKit 위젯 (config 없으면 비활성)
 */
export default function WalletModal({ devMode = false }: { devMode?: boolean }) {
  const [address, setAddress] = useState<string | null>(getWalletAddress());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [humanity, setHumanity] = useState<string | null>(localStorage.getItem('humanityCredential'));
  const [passport, setPassport] = useState<string | null>(localStorage.getItem('passportCredential'));
  const [widEnabled, setWidEnabled] = useState(false);
  const [widAppId, setWidAppId] = useState('');
  const [widAction, setWidAction] = useState('');
  const [humanityLoading, setHumanityLoading] = useState(false);

  const ethereum = (window as any).ethereum;

  useEffect(() => {
    fetchWorldIDConfig().then((cfg) => {
      setWidEnabled(cfg.enabled);
      setWidAppId(cfg.app_id || '');
      setWidAction(cfg.action_id || '');
    });
  }, []);

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
    localStorage.removeItem('humanityCredential');
    localStorage.removeItem('passportCredential');
    setAddress(null);
    setHumanity(null);
    setPassport(null);
  }

  /** devMode ZKPassport 모의 (로컬 플래그만 — 서버 검증 없음) */
  function mockPassport() {
    setHumanityLoading(true);
    setError(null);
    setTimeout(() => {
      localStorage.setItem('passportCredential', 'dev-mock-passport:age>=18');
      setPassport('dev-mock-passport:age>=18');
      setHumanityLoading(false);
    }, 300);
  }

  /** devMode 인간 증명 모의 (로컬 플래그만 — 서버 검증 없음) */
  function mockHumanity() {
    setHumanityLoading(true);
    setError(null);
    setTimeout(() => {
      localStorage.setItem('humanityCredential', 'dev-mock-humanity');
      setHumanity('dev-mock-humanity');
      setHumanityLoading(false);
    }, 300);
  }

  /** 실모드: World ID 프루프 검증 (nonce 바인딩) */
  async function handleWorldIDSuccess(result: ISuccessResult) {
    setHumanityLoading(true);
    setError(null);
    try {
      const wallet = getWalletAddress();
      if (!wallet) throw new Error('지갑 연결이 필요합니다');
      const { nonce } = await humanityNonce();
      const cred = await humanityVerify(result.proof, result.merkle_root, wallet, nonce);
      localStorage.setItem('humanityCredential', cred.credentialId);
      setHumanity(cred.credentialId);
    } catch (e: any) {
      setError(e.message || '인간 증명 실패');
    } finally {
      setHumanityLoading(false);
    }
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
      <div className="p-4 border rounded-lg bg-green-50 space-y-3">
        <div>
          <p className="text-sm font-medium">✅ 지갑 연결됨</p>
          <p className="text-xs text-gray-600 break-all">{address}</p>
        </div>
        <div className="border-t border-green-200 pt-3">
          <p className="text-sm font-medium mb-1">
            {humanity ? '✅ 인간 증명 완료' : '🧑 인간 증명 (World ID)'}
          </p>
          {humanity ? (
            <p className="text-xs text-gray-600 break-all">{humanity}</p>
          ) : devMode ? (
            <button
              onClick={mockHumanity}
              disabled={humanityLoading}
              className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs disabled:opacity-50"
            >
              {humanityLoading ? '처리 중...' : '개발모드 인간 증명 완료'}
            </button>
          ) : widEnabled ? (
            <IDKitWidget
              app_id={widAppId}
              action={widAction}
              signal={address}
              verification_level={VerificationLevel.Device}
              onSuccess={handleWorldIDSuccess}
            >
              {({ open }) => (
                <button
                  onClick={open}
                  disabled={humanityLoading}
                  className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs disabled:opacity-50"
                >
                  {humanityLoading ? '검증 중...' : 'World ID로 인간 증명'}
                </button>
              )}
            </IDKitWidget>
          ) : (
            <p className="text-xs text-gray-500">World ID 미설정 — 관리자에게 문의하세요.</p>
          )}
        </div>
        <div className="border-t border-green-200 pt-3">
          <p className="text-sm font-medium mb-1">
            {passport ? '✅ 속성 증명 완료 (ZKPassport)' : '🛂 속성 증명 (ZKPassport)'}
          </p>
          {passport ? (
            <p className="text-xs text-gray-600 break-all">{passport}</p>
          ) : devMode ? (
            <button
              onClick={mockPassport}
              disabled={humanityLoading}
              className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs disabled:opacity-50"
            >
              {humanityLoading ? '처리 중...' : '개발모드 속성 증명 완료'}
            </button>
          ) : (
            <p className="text-xs text-gray-500">
              ZKPassport 실증명은 ZKPassport 앱(ePassport NFC) 필요 — 준비되면 활성화됩니다.
            </p>
          )}
        </div>
        <button
          onClick={handleLogout}
          className="text-xs text-red-600 underline"
        >
          연결 해제
        </button>
        {error && <p className="text-xs text-red-600">{error}</p>}
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
