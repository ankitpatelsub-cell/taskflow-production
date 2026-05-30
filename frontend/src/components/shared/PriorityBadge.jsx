import { cn } from '@/lib/utils';

const config = {
  low:      { label: 'Low',      class: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-400' },
  medium:   { label: 'Medium',   class: 'bg-blue-50 text-blue-700 border-blue-200',           dot: 'bg-blue-400' },
  high:     { label: 'High',     class: 'bg-orange-50 text-orange-700 border-orange-200',     dot: 'bg-orange-400' },
  critical: { label: 'Critical', class: 'bg-red-50 text-red-700 border-red-200',               dot: 'bg-red-500' },
};

export function PriorityBadge({ priority }) {
  const c = config[priority] || config.medium;
  return (
    <span className={cn('inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold border', c.class)}>
      <span className={cn('w-1.5 h-1.5 rounded-full', c.dot)} />
      {c.label}
    </span>
  );
}
