import { X } from 'lucide-react';
import { useEffect } from 'react';

interface SimpleModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  className?: string;
}

/**
 * SimpleModal — 모바일/데스크톱 공통 모달
 * - 모바일: 하단 시트(bottom sheet) + 전체 폭, 데스크톱: 중앙 카드
 * - ESC 키 닫기 + 오버레이 클릭 닫기 + X 버튼 (44px 터치 타겟)
 * - 모달 열림 시 body 스크롤 잠금 (배경 스크롤 방지)
 */
export function SimpleModal({ open, onClose, title, children, className = '' }: SimpleModalProps) {
  // ESC 키로 닫기
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  // 모달 열림 시 body 스크롤 잠금 (모바일 배경 스크롤 방지)
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/70"
        onClick={onClose}
      />

      {/* Content — 모바일: 하단 시트, 데스크톱: 중앙 카드 */}
      <div
        className={`relative bg-[#141414] border border-[#262626] rounded-t-xl sm:rounded-lg w-full sm:max-w-2xl max-h-[92vh] overflow-y-auto p-5 sm:p-6 shadow-xl ${className}`}
      >
        {/* Close button — 44px 터치 타겟 */}
        <button
          onClick={onClose}
          aria-label="닫기"
          className="absolute top-3 right-3 w-11 h-11 flex items-center justify-center text-[#737373] hover:text-[#fafafa] transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Title - only render if title is not empty */}
        {title && (
          <h2 className="text-xl font-semibold text-[#fafafa] mb-4">{title}</h2>
        )}

        {/* Children */}
        {children}
      </div>
    </div>
  );
}
