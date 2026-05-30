import { useQuery, useMutation } from '@tanstack/react-query';
import api from '@/lib/api';
import { queryClient } from '@/lib/queryClient';
import { Button } from '@/components/ui/Button';
import { formatDate } from '@/lib/utils';
import { Database, Upload, RefreshCw } from 'lucide-react';
import { useRef, useState } from 'react';

export function BackupManager() {
  const { data: backups = [], isLoading } = useQuery({
    queryKey: ['backups'],
    queryFn: () => api.get('/admin/backups').then((r) => r.data),
  });

  const create = useMutation({
    mutationFn: () => api.post('/admin/backups', { notes: 'Manual backup' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['backups'] }),
  });

  const restore = useMutation({
    mutationFn: (file) => {
      const fd = new FormData();
      fd.append('file', file);
      return api.post('/admin/backups/restore', fd);
    },
    onSuccess: (res) => {
      alert(res.data.message);
      queryClient.invalidateQueries({ queryKey: ['backups'] });
    },
    onError: (err) => alert(err.response?.data?.error || 'Restore failed'),
  });

  const fileRef = useRef();
  const [confirmRestore, setConfirmRestore] = useState(false);

  function handleRestoreFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    if (!confirm('WARNING: This will replace the current database. All unsaved work will be lost. Continue?')) return;
    restore.mutate(file);
    e.target.value = '';
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Database Backups</h2>
          <p className="text-sm text-gray-500 mt-0.5">Encrypted backups — stored on server, scheduled nightly at 2 AM</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => fileRef.current?.click()} disabled={restore.isPending}>
            <Upload size={16} />
            {restore.isPending ? 'Restoring…' : 'Restore Backup'}
          </Button>
          <Button onClick={() => create.mutate()} disabled={create.isPending}>
            <Database size={16} />
            {create.isPending ? 'Creating…' : 'Backup Now'}
          </Button>
          <input ref={fileRef} type="file" accept=".enc,.db" className="hidden" onChange={handleRestoreFile} />
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-12 bg-gray-100 rounded-lg animate-pulse" />)}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Filename</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Size</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Created by</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Date</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {backups.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">No backups yet</td></tr>
              )}
              {backups.map((b) => (
                <tr key={b.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs text-gray-700">{b.filename}</td>
                  <td className="px-4 py-3 text-gray-600">{(b.size_bytes / 1024).toFixed(1)} KB</td>
                  <td className="px-4 py-3 text-gray-600">{b.created_by_name || 'Scheduled'}</td>
                  <td className="px-4 py-3 text-gray-600">{formatDate(b.created_at)}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{b.notes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
