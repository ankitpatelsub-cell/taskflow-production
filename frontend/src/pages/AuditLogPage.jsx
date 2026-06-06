import { useState } from 'react';
import { useSearch, useNavigate } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { formatDate } from '@/lib/utils';
import {
  ClipboardList, ChevronLeft, ChevronRight,
  Plus, Pencil, Trash2, CheckCircle2, MessageSquare,
  FolderKanban, Filter,
} from 'lucide-react';

const PAGE_SIZE = 50;

// ── Entity type options ───────────────────────────────────────────────────────
const ENTITY_TYPES = [
  { value: '',        label: 'All types' },
  { value: 'task',    label: 'Tasks' },
  { value: 'project', label: 'Projects' },
  { value: 'comment', label: 'Comments' },
  { value: 'user',    label: 'Users' },
];

// ── Action icon + color ───────────────────────────────────────────────────────
const ACTION_META = {
  created:   { Icon: Plus,         cls: 'text-emerald-500 bg-emerald-50' },
  updated:   { Icon: Pencil,       cls: 'text-blue-500    bg-blue-50'    },
  deleted:   { Icon: Trash2,       cls: 'text-red-500     bg-red-50'     },
  completed: { Icon: CheckCircle2, cls: 'text-green-500   bg-green-50'   },
  commented: { Icon: MessageSquare,cls: 'text-purple-500  bg-purple-50'  },
};

function ActionChip({ action }) {
  const meta = ACTION_META[action] ?? { Icon: FolderKanban, cls: 'text-gray-500 bg-gray-100' };
  const { Icon, cls } = meta;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${cls}`}>
      <Icon size={10} /> {action}
    </span>
  );
}

// ── Entity type badge ─────────────────────────────────────────────────────────
const ENTITY_COLORS = {
  task:    'bg-indigo-50 text-indigo-700',
  project: 'bg-amber-50  text-amber-700',
  comment: 'bg-purple-50 text-purple-700',
  user:    'bg-teal-50   text-teal-700',
};

function EntityBadge({ type }) {
  const cls = ENTITY_COLORS[type] ?? 'bg-gray-100 text-gray-600';
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>{type}</span>
  );
}

// ── Time formatting ───────────────────────────────────────────────────────────
function timeAgo(dateStr) {
  const diff = (Date.now() - new Date(dateStr)) / 1000;
  if (diff < 60)    return 'just now';
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return formatDate(dateStr);
}

// ── Table skeleton ─────────────────────────────────────────────────────────────
function AuditSkeleton() {
  return (
    <div className="divide-y divide-gray-50">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-5 py-4">
          <Skeleton className="w-8 h-8 rounded-full shrink-0" />
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-5 w-20 rounded-full" />
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="h-4 w-20 shrink-0" />
        </div>
      ))}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export function AuditLogPage() {
  const navigate = useNavigate();

  // Read page + entity_type from URL search params
  const search = useSearch({ strict: false });
  const page       = Number(search.page ?? 1);
  const entityFilter = search.entity_type ?? '';

  const [localEntity, setLocalEntity] = useState(entityFilter);

  function applyFilter(value) {
    setLocalEntity(value);
    navigate({
      search: (prev) => ({ ...prev, entity_type: value || undefined, page: 1 }),
      replace: true,
    });
  }

  function goToPage(p) {
    navigate({
      search: (prev) => ({ ...prev, page: p }),
      replace: true,
    });
  }

  const { data, isLoading, isError } = useQuery({
    queryKey: ['audit-log', page, entityFilter],
    queryFn: () =>
      api.get('/admin/activity', {
        params: {
          page,
          limit: PAGE_SIZE,
          entity_type: entityFilter || undefined,
        },
      }).then((r) => r.data),
    keepPreviousData: true,
  });

  const entries    = data?.entries   ?? data?.logs ?? [];
  const total      = data?.total     ?? entries.length;
  const totalPages = data?.pages     ?? Math.ceil(total / PAGE_SIZE);
  const hasNext    = page < totalPages;
  const hasPrev    = page > 1;

  return (
    <div className="p-6 max-w-6xl mx-auto page-fade">

      {/* Header */}
      <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <ClipboardList size={20} className="text-indigo-500" />
            Audit Log
          </h2>
          <p className="text-sm text-gray-500 mt-0.5">
            {total > 0 ? `${total.toLocaleString()} recorded events` : 'All workspace activity'}
          </p>
        </div>

        {/* Entity type filter */}
        <div className="flex items-center gap-2">
          <Filter size={14} className="text-gray-400 shrink-0" />
          <select
            value={localEntity}
            onChange={(e) => applyFilter(e.target.value)}
            className="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {ENTITY_TYPES.map(({ value, label }) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">

        {/* Column headers */}
        <div className="hidden md:grid grid-cols-[2fr_1fr_1fr_3fr_1fr] gap-4 px-5 py-3 bg-gray-50 border-b border-gray-100">
          {['User', 'Action', 'Entity', 'Title / ID', 'When'].map((h) => (
            <span key={h} className="text-xs font-bold text-gray-400 uppercase tracking-wider">{h}</span>
          ))}
        </div>

        {isLoading ? (
          <AuditSkeleton />
        ) : isError ? (
          <div className="py-16 text-center">
            <p className="text-sm text-red-500 font-medium">Failed to load audit log</p>
            <p className="text-xs text-gray-400 mt-1">Check your admin permissions and try again.</p>
          </div>
        ) : entries.length === 0 ? (
          <div className="py-16 text-center">
            <ClipboardList size={36} className="mx-auto text-gray-200 mb-3" />
            <p className="text-sm font-medium text-gray-500">No activity recorded yet</p>
            {entityFilter && (
              <p className="text-xs text-gray-400 mt-1">
                No events for entity type "{entityFilter}".
              </p>
            )}
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {entries.map((entry) => (
              <AuditRow key={entry.id ?? `${entry.created_at}-${entry.user_id}`} entry={entry} />
            ))}
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-gray-500">
            Page {page} of {totalPages}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={!hasPrev}
              onClick={() => goToPage(page - 1)}
            >
              <ChevronLeft size={15} /> Previous
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={!hasNext}
              onClick={() => goToPage(page + 1)}
            >
              Next <ChevronRight size={15} />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Single row ────────────────────────────────────────────────────────────────
function AuditRow({ entry }) {
  const userName = entry.user_name ?? entry.user?.name ?? 'System';
  const avatarSrc = entry.user_avatar ?? entry.user?.avatar_url;
  const entityTitle = entry.entity_title ?? entry.entity_name ?? entry.entity_id ?? '—';

  return (
    <div className="grid grid-cols-1 md:grid-cols-[2fr_1fr_1fr_3fr_1fr] gap-2 md:gap-4 items-center px-5 py-4 hover:bg-gray-50/60 transition-colors">

      {/* User */}
      <div className="flex items-center gap-2.5">
        <Avatar name={userName} src={avatarSrc} size="sm" />
        <span className="text-sm font-medium text-gray-800 truncate">{userName}</span>
      </div>

      {/* Action */}
      <div>
        <ActionChip action={entry.action} />
      </div>

      {/* Entity type */}
      <div>
        <EntityBadge type={entry.entity_type} />
      </div>

      {/* Title / ID */}
      <div className="min-w-0">
        <p className="text-sm text-gray-700 truncate" title={String(entityTitle)}>
          {entityTitle}
        </p>
        {entry.entity_id && entityTitle !== entry.entity_id && (
          <p className="text-xs text-gray-400 font-mono mt-0.5">#{entry.entity_id}</p>
        )}
      </div>

      {/* Timestamp */}
      <div className="text-xs text-gray-400 whitespace-nowrap" title={entry.created_at}>
        {timeAgo(entry.created_at)}
      </div>
    </div>
  );
}
