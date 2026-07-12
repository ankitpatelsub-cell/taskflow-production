import { cn } from '@/lib/utils';

const variants = {
  primary:   'bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm shadow-indigo-200 active:scale-[0.98]',
  secondary: 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50 shadow-sm active:scale-[0.98]',
  danger:    'bg-red-600 text-white hover:bg-red-700 shadow-sm active:scale-[0.98]',
  ghost:     'text-gray-600 hover:bg-gray-100 hover:text-gray-900',
  success:   'bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm active:scale-[0.98]',
};
const sizes = {
  sm:   'px-3 py-1.5 text-xs font-semibold',
  md:   'px-4 py-2 text-sm font-semibold',
  lg:   'px-5 py-2.5 text-sm font-semibold',
  icon: 'p-2',
};

export function Button({ variant = 'primary', size = 'md', className, children, disabled, loading, ...props }) {
  return (
    <button
      {...props}
      disabled={disabled || !!loading}
      className={cn(
        'inline-flex items-center justify-center gap-1.5 rounded-xl transition-all',
        'focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1',
        'disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none',
        variants[variant],
        sizes[size],
        className
      )}
    >
      {children}
    </button>
  );
}
