import { useState, useEffect } from 'react';
import { Keyboard } from 'lucide-react';

const SHORTCUTS = [
  { key: 'D',   desc: 'Go to Dashboard' },
  { key: 'N',   desc: 'Notifications' },
  { key: 'B',   desc: 'Board view (in project)' },
  { key: 'L',   desc: 'List view (in project)' },
  { key: 'S',   desc: 'Standup view (in project)' },
  { key: 'T',   desc: 'Toggle dark/light mode' },
  { key: '\\',  desc: 'Toggle sidebar' },
  { key: 'Esc', desc: 'Close drawer/modal' },
  { key: '?',   desc: 'Show this help' },
];

export function KeyboardShortcutsHelp() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function handler(e) {
      const tag = document.activeElement?.tagName;
      if (['INPUT','TEXTAREA','SELECT'].includes(tag)) return;
      if (e.key === '?') setOpen((o) => !o);
      if (e.key === 'Escape') setOpen(false);
    }
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-20 right-7 z-30 text-gray-400 dark:text-slate-500 hover:text-indigo-500 transition-colors"
        title="Keyboard shortcuts (?)"
      >
        <Keyboard size={18} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40" onClick={() => setOpen(false)} />
          <div className="fixed bottom-1/2 right-1/2 translate-x-1/2 translate-y-1/2 z-50 bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-gray-100 dark:border-slate-700 p-6 min-w-72">
            <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <Keyboard size={16} className="text-indigo-500" /> Keyboard Shortcuts
            </h3>
            <div className="space-y-2">
              {SHORTCUTS.map(({ key, desc }) => (
                <div key={key} className="flex items-center justify-between gap-4">
                  <span className="text-sm text-gray-600 dark:text-slate-300">{desc}</span>
                  <kbd className="px-2 py-0.5 bg-gray-100 dark:bg-slate-700 text-gray-800 dark:text-slate-200 text-xs font-mono rounded-lg border border-gray-200 dark:border-slate-600 shrink-0">
                    {key}
                  </kbd>
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-400 dark:text-slate-500 mt-4 text-center">Press <kbd className="bg-gray-100 dark:bg-slate-700 px-1.5 py-0.5 rounded text-xs font-mono">?</kbd> to toggle</p>
          </div>
        </>
      )}
    </>
  );
}
