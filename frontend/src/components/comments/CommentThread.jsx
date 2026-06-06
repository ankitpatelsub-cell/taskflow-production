import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import api from '@/lib/api';
import { queryClient } from '@/lib/queryClient';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { useAuthStore } from '@/stores/authStore';
import { Trash2, MessageSquare } from 'lucide-react';
import { EmojiReactions } from './EmojiReactions';

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1)  return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7)  return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function CommentThread({ taskId }) {
  const { user } = useAuthStore();
  const [content, setContent] = useState('');
  const [focused, setFocused] = useState(false);
  const textareaRef = useRef(null);

  const { data: comments = [] } = useQuery({
    queryKey: ['comments', taskId],
    queryFn: () => api.get(`/tasks/${taskId}/comments`).then((r) => r.data),
    enabled: !!taskId,
  });

  const add = useMutation({
    mutationFn: () => api.post(`/tasks/${taskId}/comments`, { content }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comments', taskId] });
      setContent('');
      setFocused(false);
    },
  });

  const del = useMutation({
    mutationFn: (id) => api.delete(`/tasks/${taskId}/comments/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['comments', taskId] }),
  });

  function handleKey(e) {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && content.trim()) {
      e.preventDefault();
      add.mutate();
    }
    if (e.key === 'Escape') {
      setContent('');
      setFocused(false);
      textareaRef.current?.blur();
    }
  }

  return (
    <div className="space-y-4">
      {comments.length === 0 ? (
        <div className="text-center py-6">
          <MessageSquare size={24} className="mx-auto mb-2 text-gray-200 dark:text-slate-600" />
          <p className="text-sm text-gray-400 dark:text-slate-500">No comments yet. Be the first!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {comments.map((c) => (
            <div key={c.id} className="flex gap-3 group">
              <Avatar name={c.user_name} src={c.avatar_url} size="sm" className="shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0 bg-gray-50 dark:bg-slate-700/50 rounded-xl px-3.5 py-2.5">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-semibold text-gray-900 dark:text-white">{c.user_name}</span>
                  <span className="text-xs text-gray-400 dark:text-slate-500" title={new Date(c.created_at).toLocaleString()}>
                    {timeAgo(c.created_at)}
                  </span>
                  {(c.user_id === user?.id || user?.role === 'admin' || user?.role === 'super_admin') && (
                    <button
                      onClick={() => del.mutate(c.id)}
                      className="ml-auto opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 transition-all"
                      title="Delete comment"
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
                <p className="text-sm text-gray-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">{c.content}</p>
                <EmojiReactions commentId={c.id} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Comment form */}
      <div className="flex gap-2.5 pt-3 border-t border-gray-100 dark:border-slate-700">
        <Avatar name={user?.name} size="sm" className="shrink-0 mt-1" />
        <div className="flex-1">
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onFocus={() => setFocused(true)}
            onKeyDown={handleKey}
            rows={focused ? 3 : 2}
            placeholder="Write a comment…"
            className="w-full text-sm border border-gray-200 dark:border-slate-600 rounded-xl px-3 py-2 bg-white dark:bg-slate-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none transition-all"
          />
          {(focused || content) && (
            <div className="flex items-center justify-between mt-1.5">
              <span className="text-xs text-gray-400 dark:text-slate-500">⌘↵ to send · Esc to cancel</span>
              <div className="flex gap-2">
                {content && (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => { setContent(''); setFocused(false); }}
                  >
                    Cancel
                  </Button>
                )}
                <Button
                  size="sm"
                  disabled={!content.trim() || add.isPending}
                  onClick={() => add.mutate()}
                >
                  {add.isPending ? 'Posting…' : 'Comment'}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
