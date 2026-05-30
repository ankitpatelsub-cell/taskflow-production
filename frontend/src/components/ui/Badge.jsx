import { cn } from '@/lib/utils';

export function Badge({ children, className }) {
  return (
    <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium border', className)}>
      {children}
    </span>
  );
}
