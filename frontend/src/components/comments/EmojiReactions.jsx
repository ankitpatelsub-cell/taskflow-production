import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import api from '@/lib/api';
import { queryClient } from '@/lib/queryClient';
import { cn } from '@/lib/utils';

const EMOJI_LIST = [
  '👍', '❤️', '😂', '🎉', '👀',
  '🚀', '✅', '❌', '🔥', '💯',
  '😊', '🙌', '💪', '🤔', '😅',
  '⭐', '🐛', '🔴', '🟡', '🟢',
];

// ─── Emoji picker popover ─────────────────────────────────────────────────────
function EmojiPicker({ onSelect, onClose }) {
  const ref = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) {
        onClose();
      }
    }
    function handleKey(e) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKey);
    };
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="absolute bottom-full left-0 mb-1.5 z-30 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-xl shadow-lg p-2"
    >
      <div className="grid grid-cols-5 gap-1">
        {EMOJI_LIST.map((emoji) => (
          <button
            key={emoji}
            onClick={() => { onSelect(emoji); onClose(); }}
            className="w-8 h-8 flex items-center justify-center text-lg rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
            title={emoji}
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export function EmojiReactions({ commentId }) {
  const [pickerOpen, setPickerOpen] = useState(false);

  const queryKey = ['reactions', commentId];

  const { data: reactions = [] } = useQuery({
    queryKey,
    queryFn: () =>
      api.get(`/comments/${commentId}/reactions`).then((r) => r.data),
    enabled: !!commentId,
  });

  const addReaction = useMutation({
    mutationFn: (emoji) =>
      api.post(`/comments/${commentId}/reactions`, { emoji }).then((r) => r.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const removeReaction = useMutation({
    mutationFn: (emoji) =>
      api.delete(`/comments/${commentId}/reactions/${encodeURIComponent(emoji)}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  function handleToggle(emoji, isMine) {
    if (isMine) {
      removeReaction.mutate(emoji);
    } else {
      addReaction.mutate(emoji);
    }
  }

  function handlePickerSelect(emoji) {
    // Check if user already reacted with this emoji
    const existing = reactions.find((r) => r.emoji === emoji);
    if (existing?.is_mine) {
      // Already reacted — do nothing or remove
      removeReaction.mutate(emoji);
    } else {
      addReaction.mutate(emoji);
    }
  }

  // Group reactions: [{ emoji, count, is_mine }]
  const grouped = Array.isArray(reactions)
    ? reactions
    : [];

  return (
    <div className="relative flex items-center flex-wrap gap-1 mt-1.5">
      {/* Existing reaction pills */}
      {grouped.map((r) => (
        <button
          key={r.emoji}
          onClick={() => handleToggle(r.emoji, r.is_mine)}
          disabled={addReaction.isPending || removeReaction.isPending}
          title={r.is_mine ? `Remove your ${r.emoji}` : `React with ${r.emoji}`}
          className={cn(
            'inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-medium transition-colors',
            'disabled:opacity-60 disabled:cursor-not-allowed',
            r.is_mine
              ? 'bg-indigo-50 dark:bg-indigo-900/30 border-indigo-300 dark:border-indigo-600 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/50'
              : 'bg-gray-50 dark:bg-slate-700 border-gray-200 dark:border-slate-600 text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-600'
          )}
        >
          <span className="text-sm leading-none">{r.emoji}</span>
          <span>{r.count}</span>
        </button>
      ))}

      {/* Add reaction "+" button + picker */}
      <div className="relative">
        <button
          onClick={() => setPickerOpen((v) => !v)}
          className={cn(
            'inline-flex items-center justify-center w-6 h-6 rounded-full border text-gray-400 dark:text-slate-500 transition-colors',
            pickerOpen
              ? 'bg-gray-100 dark:bg-slate-700 border-gray-300 dark:border-slate-500 text-gray-600 dark:text-slate-300'
              : 'bg-transparent border-gray-200 dark:border-slate-600 hover:bg-gray-100 dark:hover:bg-slate-700 hover:text-gray-600 dark:hover:text-slate-300'
          )}
          title="Add reaction"
        >
          <Plus size={11} />
        </button>

        {pickerOpen && (
          <EmojiPicker
            onSelect={handlePickerSelect}
            onClose={() => setPickerOpen(false)}
          />
        )}
      </div>
    </div>
  );
}
