import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import api from '@/lib/api';
import { queryClient } from '@/lib/queryClient';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { formatDate } from '@/lib/utils';
import { useAuthStore } from '@/stores/authStore';
import { Trash2 } from 'lucide-react';

export function CommentThread({ taskId }) {
  const { user } = useAuthStore();
  const [content, setContent] = useState('');

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
    },
  });

  const del = useMutation({
    mutationFn: (id) => api.delete(`/tasks/${taskId}/comments/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['comments', taskId] }),
  });

  return (
    <div className="space-y-4">
      {comments.map((c) => (
        <div key={c.id} className="flex gap-3">
          <Avatar name={c.user_name} src={c.avatar_url} size="sm" className="shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-2 mb-0.5">
              <span className="text-sm font-medium text-gray-900">{c.user_name}</span>
              <span className="text-xs text-gray-400">{formatDate(c.created_at)}</span>
              {(c.user_id === user?.id || user?.role === 'admin') && (
                <button onClick={() => del.mutate(c.id)} className="ml-auto text-gray-300 hover:text-red-400">
                  <Trash2 size={13} />
                </button>
              )}
            </div>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{c.content}</p>
          </div>
        </div>
      ))}

      <div className="flex gap-2 pt-2 border-t border-gray-100">
        <Avatar name={user?.name} size="sm" className="shrink-0 mt-0.5" />
        <div className="flex-1">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={2}
            placeholder="Write a comment…"
            className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none"
          />
          <div className="flex justify-end mt-1">
            <Button size="sm" disabled={!content.trim() || add.isPending} onClick={() => add.mutate()}>
              {add.isPending ? 'Posting…' : 'Comment'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
