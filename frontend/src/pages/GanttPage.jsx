import { useState, useMemo } from 'react';
import { useParams } from '@tanstack/react-router';
import { useProject } from '@/hooks/useProjects';
import { useTasks } from '@/hooks/useTasks';
import { ProjectNav } from './ProjectNav';
import { cn } from '@/lib/utils';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { addDays, format, startOfWeek, differenceInDays, parseISO, isValid } from 'date-fns';

const STATUS_BAR_COLORS = {
  todo:        'bg-slate-300',
  in_progress: 'bg-indigo-400',
  review:      'bg-amber-400',
  done:        'bg-emerald-400',
};

const WEEK_COUNT = 12; // number of weeks visible

function GanttBar({ task, viewStart, totalDays }) {
  const start = task.created_at ? parseISO(task.created_at.slice(0, 10)) : null;
  const end   = task.deadline   ? parseISO(task.deadline.slice(0, 10))   : null;

  if (!start || !isValid(start)) return null;

  const effectiveEnd = end && isValid(end) ? end : addDays(start, 1);

  const offsetDays = differenceInDays(start, viewStart);
  const spanDays   = Math.max(1, differenceInDays(effectiveEnd, start) + 1);

  if (offsetDays >= totalDays || offsetDays + spanDays < 0) return null;

  const clampedOffset = Math.max(0, offsetDays);
  const clampedSpan   = Math.min(spanDays - (clampedOffset - offsetDays), totalDays - clampedOffset);

  const leftPct  = (clampedOffset / totalDays) * 100;
  const widthPct = (clampedSpan   / totalDays) * 100;

  const color = STATUS_BAR_COLORS[task.status] || 'bg-slate-300';
  const isOverdue = end && isValid(end) && end < new Date() && task.status !== 'done';

  return (
    <div
      className={cn(
        'absolute top-1/2 -translate-y-1/2 h-5 rounded-full flex items-center px-2 text-[10px] font-semibold text-white truncate shadow-sm cursor-default',
        isOverdue ? 'bg-red-400' : color
      )}
      style={{ left: `${leftPct}%`, width: `${widthPct}%`, minWidth: '4px' }}
      title={`${task.title} · ${task.status}${end ? ' · due ' + format(end, 'MMM d') : ''}`}
    >
      {widthPct > 5 ? task.title : ''}
    </div>
  );
}

export function GanttPage() {
  const { projectId } = useParams({ strict: false });
  const { data: project } = useProject(projectId);
  const { data: tasks = [], isLoading } = useTasks(projectId);

  const [weekOffset, setWeekOffset] = useState(0);

  const viewStart = useMemo(() => {
    const base = startOfWeek(new Date(), { weekStartsOn: 1 });
    return addDays(base, weekOffset * 7);
  }, [weekOffset]);

  const totalDays = WEEK_COUNT * 7;
  const viewEnd   = addDays(viewStart, totalDays - 1);

  // Build week headers
  const weeks = useMemo(() => {
    return Array.from({ length: WEEK_COUNT }, (_, i) => {
      const wStart = addDays(viewStart, i * 7);
      return { label: format(wStart, 'MMM d'), days: 7 };
    });
  }, [viewStart]);

  // Day column headers (show every 7 days)
  const dayLabels = useMemo(() => {
    return Array.from({ length: totalDays }, (_, i) => addDays(viewStart, i));
  }, [viewStart, totalDays]);

  const topLevelTasks = tasks.filter((t) => !t.parent_task_id);

  const today = new Date();
  const todayOffset = differenceInDays(today, viewStart);
  const todayPct = (todayOffset / totalDays) * 100;
  const showTodayLine = todayOffset >= 0 && todayOffset < totalDays;

  return (
    <div className="h-full flex flex-col">
      <ProjectNav projectId={projectId} project={project} />

      <div className="flex-1 overflow-auto bg-gray-50">
        <div className="p-6">
          {/* Header controls */}
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Gantt Timeline</h2>
              <p className="text-sm text-gray-500 mt-0.5">
                {format(viewStart, 'MMM d')} – {format(viewEnd, 'MMM d, yyyy')}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setWeekOffset((w) => w - WEEK_COUNT)}
                className="p-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 transition-colors"
                title="Previous period"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                onClick={() => setWeekOffset(0)}
                className="px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-200 bg-white hover:bg-gray-50 transition-colors"
              >
                Today
              </button>
              <button
                onClick={() => setWeekOffset((w) => w + WEEK_COUNT)}
                className="p-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 transition-colors"
                title="Next period"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>

          {/* Legend */}
          <div className="flex items-center gap-4 mb-4 text-xs text-gray-500">
            {Object.entries(STATUS_BAR_COLORS).map(([s, cls]) => (
              <span key={s} className="flex items-center gap-1.5">
                <span className={cn('w-3 h-3 rounded-full inline-block', cls)} />
                {s.replace('_', ' ')}
              </span>
            ))}
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full inline-block bg-red-400" />
              overdue
            </span>
          </div>

          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-12 bg-white rounded-xl border border-gray-200 animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              {/* Grid */}
              <div className="flex">
                {/* Task name column */}
                <div className="w-56 shrink-0 border-r border-gray-200">
                  {/* Header */}
                  <div className="h-10 border-b border-gray-200 px-3 flex items-center">
                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Task</span>
                  </div>
                  {topLevelTasks.length === 0 && (
                    <div className="px-3 py-8 text-sm text-gray-400 text-center">No tasks yet</div>
                  )}
                  {topLevelTasks.map((task) => (
                    <div
                      key={task.id}
                      className="h-10 px-3 flex items-center border-b border-gray-50 last:border-0"
                    >
                      <span className="text-sm text-gray-800 truncate" title={task.title}>{task.title}</span>
                    </div>
                  ))}
                </div>

                {/* Timeline column */}
                <div className="flex-1 overflow-x-auto relative">
                  {/* Week headers */}
                  <div className="h-10 border-b border-gray-200 flex">
                    {weeks.map((w, i) => (
                      <div
                        key={i}
                        className="shrink-0 flex items-center justify-center border-r border-gray-100 last:border-0"
                        style={{ width: `${(w.days / totalDays) * 100}%`, minWidth: `${w.days * 12}px` }}
                      >
                        <span className="text-[10px] font-semibold text-gray-500 uppercase">{w.label}</span>
                      </div>
                    ))}
                  </div>

                  {/* Task rows */}
                  {topLevelTasks.map((task) => (
                    <div
                      key={task.id}
                      className="h-10 border-b border-gray-50 last:border-0 relative"
                    >
                      {/* Day grid lines */}
                      {dayLabels.filter((_, i) => i % 7 === 0).map((_, wi) => (
                        <div
                          key={wi}
                          className="absolute top-0 bottom-0 border-r border-gray-100"
                          style={{ left: `${(wi * 7 / totalDays) * 100}%` }}
                        />
                      ))}

                      {/* Today line */}
                      {showTodayLine && (
                        <div
                          className="absolute top-0 bottom-0 w-px bg-red-300 z-10"
                          style={{ left: `${todayPct}%` }}
                        />
                      )}

                      <GanttBar task={task} viewStart={viewStart} totalDays={totalDays} />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
