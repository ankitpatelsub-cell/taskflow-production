import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

export function Modal({ open, onClose, title, children, className }) {
  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm z-40 animate-[fadein_0.15s_ease]" />
        <Dialog.Content
          className={cn(
            'fixed z-50 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2',
            'bg-white rounded-2xl shadow-2xl w-full max-h-[90vh] overflow-y-auto',
            'focus:outline-none animate-[fadein_0.15s_ease]',
            className || 'max-w-lg'
          )}
        >
          {title && (
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100">
              <Dialog.Title className="text-base font-bold text-gray-900">{title}</Dialog.Title>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 rounded-lg p-1 hover:bg-gray-100 transition-colors"
              >
                <X size={17} />
              </button>
            </div>
          )}
          <div className="px-6 py-5">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
