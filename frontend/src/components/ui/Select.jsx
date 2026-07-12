import { cn } from '@/lib/utils';
import { forwardRef } from 'react';

export const Select = forwardRef(function Select({ className, children, ...props }, ref) {
  return (
    <select
      ref={ref}
      {...props}
      className={cn(
        'w-full rounded-xl border border-gray-200 px-3 py-2 text-sm shadow-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:opacity-50',
        className
      )}
    >
      {children}
    </select>
  );
});
