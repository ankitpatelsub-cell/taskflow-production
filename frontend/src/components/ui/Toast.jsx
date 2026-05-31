import * as ToastPrimitive from '@radix-ui/react-toast';
import { create } from 'zustand';
import { X, CheckCircle2, AlertCircle, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Toast store ─────────────────────────────────────────────────────────────
let nextId = 0;
export const useToastStore = create((set) => ({
  toasts: [],
  add: (toast) => set((s) => ({ toasts: [...s.toasts, { id: ++nextId, ...toast }] })),
  remove: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

export function toast(message, { type = 'info', title } = {}) {
  useToastStore.getState().add({ message, type, title });
}
toast.success = (message, opts) => toast(message, { ...opts, type: 'success' });
toast.error   = (message, opts) => toast(message, { ...opts, type: 'error' });
toast.info    = (message, opts) => toast(message, { ...opts, type: 'info' });

// ─── Icons per type ───────────────────────────────────────────────────────────
const ICONS = {
  success: <CheckCircle2 size={16} className="text-emerald-500 shrink-0 mt-0.5" />,
  error:   <AlertCircle  size={16} className="text-red-500 shrink-0 mt-0.5" />,
  info:    <Info         size={16} className="text-indigo-500 shrink-0 mt-0.5" />,
};

// ─── Provider (mount once in AppShell) ───────────────────────────────────────
export function ToastProvider() {
  const { toasts, remove } = useToastStore();

  return (
    <ToastPrimitive.Provider swipeDirection="right">
      {toasts.map((t) => (
        <ToastPrimitive.Root
          key={t.id}
          open
          onOpenChange={(open) => { if (!open) remove(t.id); }}
          duration={4000}
          className={cn(
            'flex items-start gap-3 px-4 py-3 rounded-xl shadow-lg border bg-white dark:bg-slate-800',
            'data-[state=open]:animate-[fadein_0.2s_ease]',
            'data-[state=closed]:animate-[fadeout_0.2s_ease]',
            t.type === 'success' ? 'border-emerald-200 dark:border-emerald-800' :
            t.type === 'error'   ? 'border-red-200 dark:border-red-800' :
                                   'border-indigo-200 dark:border-indigo-800'
          )}
        >
          {ICONS[t.type]}
          <div className="flex-1 min-w-0">
            {t.title && (
              <ToastPrimitive.Title className="text-sm font-semibold text-gray-900 dark:text-white">
                {t.title}
              </ToastPrimitive.Title>
            )}
            <ToastPrimitive.Description className="text-sm text-gray-600 dark:text-slate-300">
              {t.message}
            </ToastPrimitive.Description>
          </div>
          <ToastPrimitive.Close
            onClick={() => remove(t.id)}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 p-0.5 rounded transition-colors shrink-0"
          >
            <X size={14} />
          </ToastPrimitive.Close>
        </ToastPrimitive.Root>
      ))}

      <ToastPrimitive.Viewport className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2 w-full max-w-sm px-4" />
    </ToastPrimitive.Provider>
  );
}
