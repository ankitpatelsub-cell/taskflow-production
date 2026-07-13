import { useState, useEffect } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useProjects } from '@/hooks/useProjects';
import { useAuthStore } from '@/stores/authStore';
import { CheckCircle2, Circle, X, Rocket } from 'lucide-react';
import { cn } from '@/lib/utils';

const STORAGE_KEY = 'tf_onboarding_dismissed';

function useOnboardingState() {
  const { user } = useAuthStore();
  const { data: projects = [] } = useProjects();

  const hasProject = projects.length > 0;
  const hasTask    = projects.some(p => (p.task_count || 0) > 0);
  const hasTeam    = projects.some(p => (p.member_count || 0) > 1);

  const steps = [
    { id: 'account', label: 'Create your account',        done: true },
    { id: 'project', label: 'Create your first project',  done: hasProject },
    { id: 'task',    label: 'Add your first task',        done: hasTask },
    { id: 'team',    label: 'Invite a teammate',          done: hasTeam },
  ];

  const completed = steps.filter(s => s.done).length;
  const allDone   = completed === steps.length;

  return { steps, completed, total: steps.length, allDone };
}

export function OnboardingChecklist() {
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(STORAGE_KEY) === '1');
  const [expanded,  setExpanded]  = useState(true);
  const navigate = useNavigate();
  const { steps, completed, total, allDone } = useOnboardingState();

  // Auto-dismiss once everything is done
  useEffect(() => {
    if (allDone) {
      const t = setTimeout(() => dismiss(), 4000);
      return () => clearTimeout(t);
    }
  }, [allDone]);

  function dismiss() {
    localStorage.setItem(STORAGE_KEY, '1');
    setDismissed(true);
  }

  if (dismissed) return null;

  const pct = Math.round((completed / total) * 100);

  return (
    <div className="fixed bottom-5 right-5 z-40 w-72 bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-gray-100 dark:border-slate-700 overflow-hidden">
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-indigo-500 to-coral-400 cursor-pointer"
        onClick={() => setExpanded(e => !e)}
      >
        <div className="flex items-center gap-2">
          <Rocket size={15} className="text-indigo-200" />
          <span className="text-sm font-bold text-white">Getting started</span>
          <span className="text-xs text-indigo-200">{completed}/{total}</span>
        </div>
        <button onClick={(e) => { e.stopPropagation(); dismiss(); }} className="text-indigo-200 hover:text-white">
          <X size={15} />
        </button>
      </div>

      {expanded && (
        <>
          {/* Progress bar */}
          <div className="h-1 bg-gray-100 dark:bg-slate-700">
            <div
              className="h-full bg-indigo-500 transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>

          {/* Steps */}
          <div className="p-3 space-y-1">
            {allDone && (
              <p className="text-center text-sm font-semibold text-emerald-600 py-2">
                🎉 You're all set! Nice work.
              </p>
            )}
            {steps.map(({ id, label, done }) => (
              <div
                key={id}
                className={cn(
                  'flex items-center gap-3 px-2 py-2 rounded-xl transition-colors',
                  !done && 'cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700'
                )}
                onClick={() => {
                  if (done) return;
                  if (id === 'project') navigate({ to: '/app/dashboard' });
                  if (id === 'task')    navigate({ to: '/app/dashboard' });
                  if (id === 'team')    navigate({ to: '/app/dashboard' });
                }}
              >
                {done
                  ? <CheckCircle2 size={18} className="text-emerald-500 shrink-0" />
                  : <Circle       size={18} className="text-gray-300 shrink-0" />
                }
                <span className={cn(
                  'text-sm',
                  done ? 'line-through text-gray-400' : 'text-gray-700 dark:text-slate-200 font-medium'
                )}>
                  {label}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
