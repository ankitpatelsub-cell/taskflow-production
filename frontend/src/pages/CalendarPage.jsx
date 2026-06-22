import { useState } from 'react';
import { useParams, Link } from '@tanstack/react-router';
import { useTasks, useCreateTask } from '@/hooks/useTasks';
import { useProject } from '@/hooks/useProjects';
import { ProjectNav } from './ProjectNav';
import { ChevronLeft, ChevronRight, Plus, Download } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Modal } from '@/components/ui/Modal';
import { TaskForm } from '@/components/tasks/TaskForm';
import { useAuthStore } from '@/stores/authStore';

const STATUS_COLOR = {
  todo:        'bg-gray-100 text-gray-700 border-gray-200',
  in_progress: 'bg-blue-100 text-blue-800 border-blue-200',
  review:      'bg-amber-100 text-amber-800 border-amber-200',
  done:        'bg-emerald-100 text-emerald-800 border-emerald-200',
};

const PRIORITY_DOT = {
  low:      'bg-gray-400',
  medium:   'bg-blue-500',
  high:     'bg-orange-500',
  critical: 'bg-red-600',
};

function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}
function getFirstDayOfMonth(year, month) {
  return new Date(year, month, 1).getDay();
}
function toYMD(date) {
  return date.toISOString().slice(0, 10);
}

export function CalendarPage() {
  const { projectId } = useParams({ strict: false });
  const { data: project } = useProject(projectId);
  const { data: tasks = [] } = useTasks(projectId);
  const create = useCreateTask(projectId);
  const [addDate, setAddDate] = useState(null);
  const { token } = useAuthStore();

  async function downloadIcal() {
    const res = await fetch(`/api/projects/${projectId}/ical.ics`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${project?.name || 'tasks'}.ics`; a.click();
    URL.revokeObjectURL(url);
  }

  const today = new Date();
  const [year,  setYear]  = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());

  const prevMonth = () => { if (month === 0) { setMonth(11); setYear(y => y - 1); } else setMonth(m => m - 1); };
  const nextMonth = () => { if (month === 11) { setMonth(0);  setYear(y => y + 1); } else setMonth(m => m + 1); };

  const daysInMonth  = getDaysInMonth(year, month);
  const firstWeekDay = getFirstDayOfMonth(year, month); // 0=Sun

  // Index tasks by their deadline date (YYYY-MM-DD)
  const tasksByDate = {};
  for (const t of tasks) {
    if (!t.deadline) continue;
    const key = t.deadline.slice(0, 10);
    if (!tasksByDate[key]) tasksByDate[key] = [];
    tasksByDate[key].push(t);
  }

  const todayStr = toYMD(today);
  const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const DAY_NAMES   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

  // Build grid cells: leading empties + day cells
  const cells = Array(firstWeekDay).fill(null).concat(
    Array.from({ length: daysInMonth }, (_, i) => i + 1)
  );
  // Pad to full rows
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div className="flex flex-col h-full">
      <ProjectNav projectId={projectId} project={project} />

      <div className="flex-1 overflow-auto p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">
            {MONTH_NAMES[month]} {year}
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={downloadIcal}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-gray-500 dark:text-slate-400 border border-gray-200 dark:border-slate-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
              title="Export to iCalendar (.ics)"
            >
              <Download size={13} /> Export .ics
            </button>
            <button
              onClick={prevMonth}
              className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-500 transition-colors"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              onClick={() => { setYear(today.getFullYear()); setMonth(today.getMonth()); }}
              className="px-3 py-1 text-xs font-semibold rounded-lg bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition-colors"
            >
              Today
            </button>
            <button
              onClick={nextMonth}
              className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-500 transition-colors"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7 gap-px bg-gray-200 dark:bg-slate-700 rounded-xl overflow-hidden border border-gray-200 dark:border-slate-700">
          {/* Day headers */}
          {DAY_NAMES.map(d => (
            <div key={d} className="bg-gray-50 dark:bg-slate-800 py-2 text-center text-xs font-semibold text-gray-500 dark:text-slate-400">
              {d}
            </div>
          ))}

          {/* Day cells */}
          {cells.map((day, idx) => {
            if (!day) {
              return <div key={`e${idx}`} className="bg-white dark:bg-slate-900 min-h-[90px]" />;
            }
            const dateStr = `${year}-${String(month + 1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
            const dayTasks = tasksByDate[dateStr] || [];
            const isToday = dateStr === todayStr;
            const isPast  = dateStr < todayStr;

            return (
              <div
                key={dateStr}
                onClick={() => !isPast && setAddDate(dateStr)}
                className={cn(
                  'group bg-white dark:bg-slate-900 min-h-[90px] p-1.5 transition-colors',
                  isPast && !isToday ? 'opacity-60' : 'cursor-pointer hover:bg-indigo-50/30 dark:hover:bg-indigo-900/10'
                )}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className={cn(
                    'inline-flex w-6 h-6 items-center justify-center rounded-full text-xs font-bold',
                    isToday ? 'bg-indigo-600 text-white' : 'text-gray-700 dark:text-slate-300'
                  )}>
                    {day}
                  </span>
                  {!isPast && (
                    <Plus size={12} className="text-gray-300 dark:text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                  )}
                </div>

                <div className="space-y-0.5">
                  {dayTasks.slice(0, 3).map(t => (
                    <Link
                      key={t.id}
                      to={`/app/projects/${projectId}/board`}
                      className={cn(
                        'flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium border truncate hover:opacity-80 transition-opacity',
                        STATUS_COLOR[t.status]
                      )}
                      title={t.title}
                    >
                      <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', PRIORITY_DOT[t.priority])} />
                      <span className="truncate">{t.title}</span>
                    </Link>
                  ))}
                  {dayTasks.length > 3 && (
                    <p className="text-xs text-gray-400 pl-1">+{dayTasks.length - 3} more</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="mt-4 flex flex-wrap gap-3 items-center">
          {Object.entries(STATUS_COLOR).map(([s, cls]) => (
            <span key={s} className={cn('px-2 py-0.5 rounded-full text-xs font-medium border', cls)}>
              {s.replace('_', ' ')}
            </span>
          ))}
          <span className="text-xs text-gray-400 ml-2">· Click a day to add a task</span>
        </div>
      </div>

      {/* Quick-create task modal */}
      {addDate && (
        <Modal open onClose={() => setAddDate(null)} title={`New task — ${addDate}`}>
          <TaskForm
            projectId={projectId}
            defaultValues={{ deadline: addDate, priority: 'medium', status: 'todo' }}
            onSubmit={(data) => create.mutate(data, { onSuccess: () => setAddDate(null) })}
            onCancel={() => setAddDate(null)}
            loading={create.isPending}
          />
        </Modal>
      )}
    </div>
  );
}
