import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { X, Search, CheckCircle2, Loader2, ListChecks, Sparkles } from 'lucide-react';
import api from '@/lib/api';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { toast } from '@/components/ui/Toast';
import { Modal } from '@/components/ui/Modal';

// ── Category config ────────────────────────────────────────────────────────────
const CATEGORIES = {
  engineering: { label: 'Engineering', icon: '⚙️', color: '#6366f1' },
  marketing:   { label: 'Marketing',   icon: '📢', color: '#ec4899' },
  product:     { label: 'Product',     icon: '🚀', color: '#f59e0b' },
  hr:          { label: 'HR',          icon: '👥', color: '#10b981' },
  general:     { label: 'General',     icon: '📋', color: '#6b7280' },
};

const ALL_TABS = [
  { key: 'all',         label: 'All' },
  { key: 'engineering', label: 'Engineering' },
  { key: 'marketing',   label: 'Marketing' },
  { key: 'product',     label: 'Product' },
  { key: 'hr',          label: 'HR' },
  { key: 'general',     label: 'General' },
];

// ── Template card ──────────────────────────────────────────────────────────────
function TemplateCard({ template, onSelect }) {
  const cat = CATEGORIES[template.category] || CATEGORIES.general;
  return (
    <div className="group bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 p-4 flex flex-col gap-3 hover:shadow-md hover:border-indigo-200 dark:hover:border-indigo-700 transition-all">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0"
          style={{ backgroundColor: `${cat.color}18` }}
        >
          {cat.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
              {template.name}
            </p>
            {template.task_count != null && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-slate-400 text-xs font-medium">
                <ListChecks size={10} />
                {template.task_count} tasks
              </span>
            )}
          </div>
          {template.description && (
            <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5 line-clamp-2">
              {template.description}
            </p>
          )}
        </div>
      </div>

      {/* Category tag */}
      <div className="flex items-center justify-between">
        <span
          className="text-xs font-semibold px-2 py-0.5 rounded-full"
          style={{ backgroundColor: `${cat.color}18`, color: cat.color }}
        >
          {cat.label}
        </span>
        <Button
          size="sm"
          onClick={() => onSelect(template)}
          className="opacity-0 group-hover:opacity-100 transition-opacity focus:opacity-100"
        >
          Use Template
        </Button>
      </div>
    </div>
  );
}

// ── Loading skeletons ──────────────────────────────────────────────────────────
function TemplateSkeleton() {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 p-4 animate-pulse">
      <div className="flex items-start gap-3 mb-3">
        <div className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-slate-700 shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-gray-100 dark:bg-slate-700 rounded w-3/4" />
          <div className="h-3 bg-gray-100 dark:bg-slate-700 rounded w-full" />
        </div>
      </div>
      <div className="flex items-center justify-between">
        <div className="h-4 w-20 bg-gray-100 dark:bg-slate-700 rounded-full" />
        <div className="h-7 w-24 bg-gray-100 dark:bg-slate-700 rounded-lg" />
      </div>
    </div>
  );
}

// ── Save as template section ───────────────────────────────────────────────────
function SaveAsTemplateSection({ projectId }) {
  const [name, setName]           = useState('');
  const [submitted, setSubmitted] = useState(false);

  const saveMutation = useMutation({
    mutationFn: (payload) => api.post('/templates', payload).then((r) => r.data),
    onSuccess: () => {
      toast.success('Template saved successfully');
      setSubmitted(true);
      setName('');
    },
    onError: (err) => {
      toast.error(err.response?.data?.error || 'Failed to save template');
    },
  });

  if (!projectId) return null;

  function handleSave() {
    if (!name.trim()) {
      toast.error('Please enter a template name');
      return;
    }
    saveMutation.mutate({ project_id: projectId, name: name.trim() });
  }

  return (
    <div className="mt-6 border-t border-gray-100 dark:border-slate-700 pt-5">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles size={14} className="text-indigo-500" />
        <p className="text-sm font-semibold text-gray-700 dark:text-slate-200">
          Save current project as template
        </p>
      </div>
      {submitted ? (
        <div className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 size={15} />
          Template saved!
        </div>
      ) : (
        <div className="flex gap-2">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Template name…"
            className="flex-1 px-3 py-2 text-sm border border-gray-200 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-slate-800 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-slate-500"
            onKeyDown={(e) => e.key === 'Enter' && handleSave()}
          />
          <Button
            size="sm"
            variant="secondary"
            onClick={handleSave}
            loading={saveMutation.isPending}
            disabled={!name.trim()}
          >
            Save
          </Button>
        </div>
      )}
    </div>
  );
}

// ── TemplateGalleryModal ───────────────────────────────────────────────────────
/**
 * Props:
 *   onSelect(template) — called when user picks a template
 *   onClose()          — called to close the modal
 *   projectId          — optional; enables "Save as template" section
 */
export function TemplateGalleryModal({ onSelect, onClose, projectId }) {
  const [activeTab, setActiveTab] = useState('all');
  const [search, setSearch]       = useState('');

  const { data: templates = [], isLoading, isError } = useQuery({
    queryKey: ['templates'],
    queryFn: () => api.get('/templates').then((r) => r.data),
    staleTime: 5 * 60 * 1000,
  });

  // Filter by tab + search
  const filtered = templates.filter((t) => {
    const matchCat  = activeTab === 'all' || t.category === activeTab;
    const matchText = !search || t.name?.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchText;
  });

  return (
    <Modal open onClose={onClose} title="Project Templates" className="max-w-2xl">
      {/* Start blank option */}
      <div className="mb-5">
        <button
          onClick={() => onSelect(null)}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 border-dashed border-gray-200 dark:border-slate-600 hover:border-indigo-300 dark:hover:border-indigo-600 hover:bg-indigo-50/50 dark:hover:bg-indigo-900/10 transition-colors group"
        >
          <div className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-slate-700 flex items-center justify-center text-xl group-hover:bg-indigo-100 dark:group-hover:bg-indigo-900/30 transition-colors">
            ✨
          </div>
          <div className="text-left">
            <p className="text-sm font-semibold text-gray-900 dark:text-white">Start blank</p>
            <p className="text-xs text-gray-500 dark:text-slate-400">Begin from scratch with an empty project</p>
          </div>
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search templates…"
          className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-slate-800 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-slate-500"
        />
      </div>

      {/* Category tabs */}
      <div className="flex gap-1 mb-5 overflow-x-auto pb-1">
        {ALL_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              'shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors',
              activeTab === tab.key
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Template grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[360px] overflow-y-auto pr-1">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <TemplateSkeleton key={i} />)
        ) : isError ? (
          <div className="col-span-2 text-center py-10 text-gray-400 dark:text-slate-500 text-sm">
            Failed to load templates.
          </div>
        ) : filtered.length === 0 ? (
          <div className="col-span-2 flex flex-col items-center py-12 text-gray-400 dark:text-slate-500">
            <ListChecks size={32} className="mb-2 opacity-40" />
            <p className="text-sm font-medium">No templates found</p>
            <p className="text-xs mt-0.5">Try a different category or search term</p>
          </div>
        ) : (
          filtered.map((t) => (
            <TemplateCard key={t.id} template={t} onSelect={onSelect} />
          ))
        )}
      </div>

      {/* Save as template */}
      <SaveAsTemplateSection projectId={projectId} />
    </Modal>
  );
}
