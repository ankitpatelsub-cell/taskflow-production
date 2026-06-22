import { useState } from 'react';
import { useParams } from '@tanstack/react-router';
import { useQuery, useMutation } from '@tanstack/react-query';
import api from '@/lib/api';
import { STATUS_LABELS, formatDate } from '@/lib/utils';
import { CheckSquare, MessageSquare, Eye, AlertCircle, Loader2 } from 'lucide-react';

function GuestView({ token }) {
  const [guestName, setGuestName] = useState(() => localStorage.getItem('guestName') || '');
  const [nameSet, setNameSet] = useState(() => !!localStorage.getItem('guestName'));
  const [commentTask, setCommentTask] = useState(null);
  const [commentBody, setCommentBody] = useState('');
  const [commentError, setCommentError] = useState('');

  const { data, isLoading, error } = useQuery({
    queryKey: ['guest-view', token],
    queryFn: () => api.get(`/guest/${token}`).then(r => r.data),
    retry: false,
  });

  const postComment = useMutation({
    mutationFn: ({ task_id, body }) =>
      api.post(`/guest/${token}/comment`, { task_id, body, guest_name: guestName }),
    onSuccess: () => {
      setCommentBody('');
      setCommentTask(null);
      setCommentError('');
    },
    onError: (err) => setCommentError(err.response?.data?.error || 'Failed to post comment'),
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 size={28} className="animate-spin text-indigo-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <AlertCircle size={36} className="text-red-400 mx-auto mb-3" />
          <h2 className="text-lg font-bold text-gray-800">Link invalid or expired</h2>
          <p className="text-gray-500 text-sm mt-1">
            This guest link may have been revoked or has expired.
          </p>
        </div>
      </div>
    );
  }

  const { project, tasks, permissions } = data;
  const canComment = ['comment', 'edit'].includes(permissions);

  if (!nameSet && canComment) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-sm text-center">
          <CheckSquare size={32} className="text-indigo-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-800 mb-2">Welcome, guest!</h2>
          <p className="text-gray-500 text-sm mb-6">Enter your name to continue</p>
          <input
            type="text"
            value={guestName}
            onChange={e => setGuestName(e.target.value)}
            placeholder="Your name"
            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            onKeyDown={e => {
              if (e.key === 'Enter' && guestName.trim()) {
                localStorage.setItem('guestName', guestName.trim());
                setNameSet(true);
              }
            }}
          />
          <button
            onClick={() => {
              if (!guestName.trim()) return;
              localStorage.setItem('guestName', guestName.trim());
              setNameSet(true);
            }}
            className="w-full bg-indigo-600 text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-indigo-700 transition-colors"
          >
            Continue
          </button>
        </div>
      </div>
    );
  }

  const byStatus = tasks.reduce((acc, t) => {
    acc[t.status] = acc[t.status] || [];
    acc[t.status].push(t);
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-lg shrink-0"
              style={{ backgroundColor: project.color || '#6366f1' }}
            />
            <div>
              <h1 className="font-bold text-gray-900">{project.name}</h1>
              {project.description && (
                <p className="text-xs text-gray-500 mt-0.5">{project.description}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-gray-400 bg-gray-50 px-3 py-1.5 rounded-full border border-gray-200">
            {canComment ? <MessageSquare size={12} /> : <Eye size={12} />}
            {canComment ? 'Can comment' : 'View only'}
          </div>
        </div>
      </div>

      {/* Task columns */}
      <div className="max-w-5xl mx-auto px-6 py-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {['todo', 'in_progress', 'review', 'done'].map(status => (
            <div key={status}>
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">
                {STATUS_LABELS[status] || status} · {(byStatus[status] || []).length}
              </h3>
              <div className="space-y-2">
                {(byStatus[status] || []).map(task => (
                  <div key={task.id} className="bg-white rounded-xl border border-gray-100 p-3 shadow-sm">
                    <p className="text-sm font-medium text-gray-800 leading-snug">{task.title}</p>
                    {task.assignee_name && (
                      <p className="text-xs text-gray-400 mt-1.5">{task.assignee_name}</p>
                    )}
                    {task.deadline && (
                      <p className="text-xs text-gray-400 mt-0.5">{formatDate(task.deadline)}</p>
                    )}
                    {canComment && (
                      <button
                        onClick={() => { setCommentTask(task); setCommentBody(''); setCommentError(''); }}
                        className="mt-2 text-xs text-indigo-500 hover:text-indigo-700 flex items-center gap-1"
                      >
                        <MessageSquare size={11} /> Comment
                      </button>
                    )}
                  </div>
                ))}
                {(byStatus[status] || []).length === 0 && (
                  <p className="text-xs text-gray-300 text-center py-4">Empty</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Comment modal */}
      {commentTask && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h3 className="font-bold text-gray-800 mb-1">Add comment</h3>
            <p className="text-sm text-gray-500 mb-4 truncate">"{commentTask.title}"</p>
            <textarea
              value={commentBody}
              onChange={e => setCommentBody(e.target.value)}
              placeholder="Write your comment…"
              rows={4}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            {commentError && <p className="text-xs text-red-500 mt-1">{commentError}</p>}
            <div className="flex gap-2 mt-4 justify-end">
              <button
                onClick={() => setCommentTask(null)}
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={() => postComment.mutate({ task_id: commentTask.id, body: commentBody })}
                disabled={!commentBody.trim() || postComment.isPending}
                className="px-4 py-2 text-sm bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 disabled:opacity-50"
              >
                {postComment.isPending ? 'Posting…' : 'Post comment'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function GuestViewPage() {
  const { token } = useParams({ strict: false });
  return <GuestView token={token} />;
}
