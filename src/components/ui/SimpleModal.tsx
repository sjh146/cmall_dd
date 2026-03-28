import { X } from 'lucide-react';

interface SimpleModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  className?: string;
}

export function SimpleModal({ open, onClose, title, children, className = '' }: SimpleModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Overlay */}
      <div 
        className="absolute inset-0 bg-black/60"
        onClick={onClose}
      />
      
      {/* Content */}
      <div className={`relative bg-[#141414] border border-[#262626] rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 shadow-xl ${className}`}>
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-[#737373] hover:text-[#fafafa] transition-colors"
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
