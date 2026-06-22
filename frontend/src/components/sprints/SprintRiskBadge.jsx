import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Shield, AlertTriangle, Flame, AlertCircle } from 'lucide-react';
import api from '@/lib/api';
import { cn } from '@/lib/utils';

// ── Risk level config ─────────────────────────────────────────────────────────
const RISK_CONFIG = {
  low: {
    icon: Shield,
    label: 'Low risk',
    badgeClass:
      'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800',
    iconClass: 'text-emerald-500',
  },
  medium: {
    icon: AlertTriangle,
    label: 'Medium risk',
    badgeClass:
      'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-600 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800',
    iconClass: 'text-yellow-500',
  },
  high: {
    icon: AlertCircle,
    label: 'High risk',
    badgeClass:
      'bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 border-orange-200 dark:border-orange-800',
    iconClass: 'text-orange-500',
  },
  critical: {
    icon: Flame,
    label: 'Critical risk',
    badgeClass:
      'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800',
    iconClass: 'text-red-500',
  },
};

// ── Tooltip ───────────────────────────────────────────────────────────────────
function RiskTooltip({ data, visible }) {
  if (!visible || !data) return null;
  return (
    <div
      className={cn(
        'absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50',
        'bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700',
        'shadow-lg p-3 min-w-[200px] max-w-[280px] pointer-events-none'
      )}
    >
      {/* Arrow */}
      <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-[6px] border-r-[6px] border-t-[6px] border-l-transparent border-r-transparent border-t-white dark:border-t-slate-800" />

      <div className="space-y-2">
        {/* Score */}
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-gray-500 dark:text-slate-400">Risk Score</span>
          <span className="text-xs font-bold text-gray-800 dark:text-white">
            {data.risk_score ?? '—'}
          </span>
        </div>

        {/* Days remaining */}
        {data.days_remaining != null && (
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 dark:text-slate-400">Days Left</span>
            <span className="text-xs font-bold text-gray-800 dark:text-white">
              {data.days_remaining}d
            </span>
          </div>
        )}

        {/* Factors */}
        {data.factors?.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 mb-1">Factors</p>
            <ul className="space-y-0.5">
              {data.factors.map((f, i) => (
                <li key={i} className="text-xs text-gray-600 dark:text-slate-300 flex items-start gap-1.5">
                  <span className="mt-1 w-1 h-1 rounded-full bg-gray-400 dark:bg-slate-500 shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

// ── SprintRiskBadge ────────────────────────────────────────────────────────────
/**
 * Props:
 *   projectId  — required
 *   sprintId   — required
 *   status     — sprint status; badge is hidden if 'completed'
 */
export function SprintRiskBadge({ projectId, sprintId, status }) {
  const [hovered, setHovered] = useState(false);

  const { data } = useQuery({
    queryKey: ['sprint-risk', projectId, sprintId],
    queryFn: () =>
      api
        .get(`/projects/${projectId}/sprints/${sprintId}/risk`)
        .then((r) => r.data),
    enabled: !!projectId && !!sprintId && status !== 'completed',
    staleTime: 2 * 60 * 1000,
  });

  // Hide for completed sprints or when risk is none/unknown/absent
  if (
    status === 'completed' ||
    !data ||
    !data.risk_level ||
    data.risk_level === 'none' ||
    data.risk_level === 'unknown'
  ) {
    return null;
  }

  const cfg = RISK_CONFIG[data.risk_level];
  if (!cfg) return null;

  const Icon = cfg.icon;

  return (
    <div
      className="relative inline-flex"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <span
        className={cn(
          'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border cursor-default',
          cfg.badgeClass
        )}
      >
        <Icon size={11} className={cfg.iconClass} />
        {cfg.label}
      </span>
      <RiskTooltip data={data} visible={hovered} />
    </div>
  );
}
