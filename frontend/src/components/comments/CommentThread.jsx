import { useState, useRef } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import api from '@/lib/api';
import { queryClient } from '@/lib/queryClient';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { useAuthStore } from '@/stores/authStore';
import { Trash2, MessageSquare, CornerDownRight } from 'lucide-react';
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

function CommentBox({ taskId, parentCommentId = null, onDone, autoFocus = false, placeholder = 'Write a comment…' }) {
  const { user } = useAuthStore();
  const [content, setContent] = useState('');
  const [focused, setFocused] = useState(autoFocus);
  const textareaRef = useRef(null);

  const add = useMutation({
    mutationFn: () => api.post(`/tasks/${taskId}/comments`, { content, parent_comment_id: parentCommentId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comments', taskId] });
      setContent('');
      setFocused(false);
      onDone?.();
    },
  });

  function handleKey(e) {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && content.trim()) {
      e.preventDefault();
      add.mutate();
    }
    if (e.key === 'Escape') {
      setContent('');
      setFocused(false);
      onDone?.();
    }
  }

  return (
    <div className="flex gap-2.5">
      <Avatar name={user?.name} size="sm" className="shrink-0 mt-1" />
      <div className="flex-1">
        <textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onFocus={() => setFocused(true)}
          onKeyDown={handleKey}
          autoFocus={autoFocus}
          rows={focused ? 3 : 2}
          placeholder={placeholder}
          className="w-full text-sm border border-gray-200 dark:border-slate-600 rounded-xl px-3 py-2 bg-white dark:bg-slate-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none transition-all"
        />
        {(focused || content) && (
          <div className="flex items-center justify-between mt-1.5">
            <span className="text-xs text-gray-400 dark:text-slate-500">⌘↵ to send · Esc to cancel</span>
            <div className="flex gap-2">
              {(content || parentCommentId) && (
                <Button size="sm" variant="secondary" onClick={() => { setContent(''); setFocused(false); onDone?.(); }}>
                  Cancel
                </Button>
              )}
              <Button size="sm" disabled={!content.trim() || add.isPending} onClick={() => add.mutate()}>
                {add.isPending ? 'Posting…' : 'Comment'}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function CommentItem({ comment, taskId, allComments, user, delMutation }) {
  const [replying, setReplying] = useState(false);
  const replies = allComments.filter((c) => c.parent_comment_id === comment.id);

  return (
    <div className="flex gap-3 group">
      <Avatar name={comment.user_name} src={comment.avatar_url} size="sm" className="shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <div className="bg-gray-50 dark:bg-slate-700/50 rounded-xl px-3.5 py-2.5">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-semibold text-gray-900 dark:text-white">{comment.user_name}</span>
            <span className="text-xs text-gray-400 dark:text-slate-500" title={new Date(comment.created_at).toLocaleString()}>
              {timeAgo(comment.created_at)}
            </span>
            {(comment.user_id === user?.id || user?.role === 'admin' || user?.role === 'super_admin') && (
              <button
                onClick={() => delMutation.mutate(comment.id)}
                className="ml-auto opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 transition-all"
                title="Delete comment"
              >
                <Trash2 size={12} />
              </button>
            )}
          </div>
          <p className="text-sm text-gray-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">{comment.content}</p>
          <EmojiReactions commentId={comment.id} />
        </div>

        {/* Reply button */}
        <button
          onClick={() => setReplying((v) => !v)}
          className="mt-1 ml-1 flex items-center gap-1 text-xs text-gray-400 hover:text-indigo-500 transition-colors"
        >
          <CornerDownRight size={11} />
          {replies.length > 0 ? `${replies.length} repl${replies.length === 1 ? 'y' : 'ies'}` : 'Reply'}
        </button>

        {/* Nested replies */}
        {replies.length > 0 && (
          <div className="mt-2 ml-3 pl-3 border-l-2 border-gray-100 dark:border-slate-700 space-y-3">
            {replies.map((r) => (
              <div key={r.id} className="flex gap-2.5 group/reply">
                <Avatar name={r.user_name} src={r.avatar_url} size="sm" className="shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0 bg-gray-50 dark:bg-slate-700/50 rounded-xl px-3 py-2">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-sm font-semibold text-gray-900 dark:text-white">{r.user_name}</span>
                    <span className="text-xs text-gray-400 dark:text-slate-500">{timeAgo(r.created_at)}</span>
                    {(r.user_id === user?.id || user?.role === 'admin' || user?.role === 'super_admin') && (
                      <button
                        onClick={() => delMutation.mutate(r.id)}
                        className="ml-auto opacity-0 group-hover/reply:opacity-100 text-gray-300 hover:text-red-500 transition-all"
                        title="Delete reply"
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                  <p className="text-sm text-gray-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">{r.content}</p>
                  <EmojiReactions commentId={r.id} />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Inline reply box */}
        {replying && (
          <div className="mt-2 ml-3 pl-3 border-l-2 border-indigo-200 dark:border-indigo-800">
            <CommentBox
              taskId={taskId}
              parentCommentId={comment.id}
              onDone={() => setReplying(false)}
              autoFocus
              placeholder={`Reply to ${comment.user_name}…`}
            />
          </div>
        )}
      </div>
    </div>
  );
}

export function CommentThread({ taskId }) {
  const { user } = useAuthStore();

  const { data: allComments = [] } = useQuery({
    queryKey: ['comments', taskId],
    queryFn: () => api.get(`/tasks/${taskId}/comments`).then((r) => r.data),
    enabled: !!taskId,
  });

  const del = useMutation({
    mutationFn: (id) => api.delete(`/tasks/${taskId}/comments/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['comments', taskId] }),
  });

  // Only top-level comments (no parent)
  const topLevel = allComments.filter((c) => !c.parent_comment_id);

  return (
    <div className="space-y-4">
      {topLevel.length === 0 ? (
        <div className="text-center py-6">
          <MessageSquare size={24} className="mx-auto mb-2 text-gray-200 dark:text-slate-600" />
          <p className="text-sm text-gray-400 dark:text-slate-500">No comments yet. Be the first!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {topLevel.map((c) => (
            <CommentItem
              key={c.id}
              comment={c}
              taskId={taskId}
              allComments={allComments}
              user={user}
              delMutation={del}
            />
          ))}
        </div>
      )}

      {/* New top-level comment form */}
      <div className="pt-3 border-t border-gray-100 dark:border-slate-700">
        <CommentBox taskId={taskId} />
      </div>
    </div>
  );
}
