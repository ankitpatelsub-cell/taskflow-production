import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import api from '@/lib/api';
import { queryClient } from '@/lib/queryClient';
import { Button } from '@/components/ui/Button';
import { Trash2, Clock } from 'lucide-react';

function fmtMins(m) {
  if (!m) return '0m';
  const h = Math.floor(m / 60);
  const r = m % 60;
  return h > 0 ? `${h}h ${r > 0 ? r + 'm' : ''}`.trim() : `${r}m`;
}

export function TimeTracker({ taskId }) {
  const [hours,   setHours]   = useState('');
  const [minutes, setMinutes] = useState('');
  const [note,    setNote]    = useState('');

  const key = ['time-logs', taskId];

  const { data: logs = [], isLoading } = useQuery({
    queryKey: key,
    queryFn: () => api.get(`/tasks/${taskId}/time-logs`).then(r => r.data),
    enabled: !!taskId,
  });

  const addLog = useMutation({
    mutationFn: (d) => api.post(`/tasks/${taskId}/time-logs`, d),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: key });
      setHours(''); setMinutes(''); setNote('');
    },
  });

  const delLog = useMutation({
    mutationFn: (logId) => api.delete(`/tasks/${taskId}/time-logs/${logId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key }),
  });

  function handleLog() {
    const h = parseInt(hours  || '0', 10);
    const m = parseInt(minutes|| '0', 10);
    const total = h * 60 + m;
    if (total < 1) return;
    addLog.mutate({ duration_minutes: total, note: note.trim() || undefined });
  }

  const total = logs.reduce((s, l) => s + (l.duration_minutes || 0), 0);

  return (
    <div className="py-2 space-y-4">
      {/* Total */}
      <div className="flex items-center gap-2 p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl">
        <Clock size={16} className="text-indigo-500" />
        <span className="text-sm font-bold text-indigo-700 dark:text-indigo-300">
          Total logged: {fmtMins(total)}
        </span>
      </div>

      {/* Log form */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Log Time</p>
        <div className="flex gap-2">
          <input
            type="number" min="0" max="99" placeholder="h"
            value={hours}
            onChange={e => setHours(e.target.value)}
            className="w-16 rounded-xl border border-gray-200 dark:border-slate-600 px-2.5 py-2 text-sm bg-white dark:bg-slate-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-center"
          />
          <span className="self-center text-gray-400 text-sm">h</span>
          <input
            type="number" min="0" max="59" placeholder="m"
            value={minutes}
            onChange={e => setMinutes(e.target.value)}
            className="w-16 rounded-xl border border-gray-200 dark:border-slate-600 px-2.5 py-2 text-sm bg-white dark:bg-slate-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-center"
          />
          <span className="self-center text-gray-400 text-sm">m</span>
          <input
            type="text" placeholder="Note (optional)"
            value={note}
            onChange={e => setNote(e.target.value)}
            className="flex-1 rounded-xl border border-gray-200 dark:border-slate-600 px-3 py-2 text-sm bg-white dark:bg-slate-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <Button
          size="sm"
          disabled={addLog.isPending || (!hours && !minutes)}
          onClick={handleLog}
          className="w-full"
        >
          {addLog.isPending ? 'Logging…' : '+ Log time'}
        </Button>
      </div>

      {/* Log list */}
      {isLoading ? (
        <div className="space-y-2">{[1,2].map(i => <div key={i} className="h-10 bg-gray-100 rounded-xl animate-pulse" />)}</div>
      ) : logs.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-4">No time logged yet</p>
      ) : (
        <div className="space-y-1.5">
          {logs.map(log => (
            <div key={log.id} className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-gray-50 dark:bg-slate-700/50 group">
              <div className="min-w-0">
                <span className="text-sm font-semibold text-gray-800 dark:text-white">{fmtMins(log.duration_minutes)}</span>
                <span className="text-xs text-gray-400 ml-2">by {log.user_name}</span>
                {log.note && <p className="text-xs text-gray-500 dark:text-slate-400 truncate">{log.note}</p>}
              </div>
              <button
                onClick={() => delLog.mutate(log.id)}
                className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 transition-all shrink-0"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
