import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useEffect } from 'react';

export function Drawer({ open, onClose, title, children, wide }) {
  // Close on Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  if (!open) return null;

  return (
    <>
      <div
        className="fixed inset-0 bg-black/30 backdrop-blur-[2px] z-40 transition-opacity"
        onClick={onClose}
      />
      <div
        className={cn(
          'fixed top-0 right-0 h-full bg-white shadow-2xl z-50 flex flex-col overflow-hidden',
          'border-l border-gray-100 animate-[slidein_0.2s_ease]',
          wide ? 'w-full max-w-2xl' : 'w-full max-w-lg'
        )}
        style={{ '--tw-shadow': '0 25px 50px -12px rgba(0,0,0,0.25)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0 bg-white">
          <h2 className="text-sm font-bold text-gray-900 truncate pr-4">{title}</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 rounded-lg p-1.5 hover:bg-gray-100 transition-colors shrink-0"
          >
            <X size={16} />
          </button>
        </div>
        {/* Body */}
        <div className="flex-1 overflow-y-auto">{children}</div>
      </div>

      <style>{`
        @keyframes slidein {
          from { transform: translateX(100%); }
          to   { transform: translateX(0); }
        }
        @keyframes fadein {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
      `}</style>
    </>
  );
}
