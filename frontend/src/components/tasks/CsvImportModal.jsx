import { useState, useRef } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import { Upload, FileText, CheckCircle2, AlertCircle, X } from 'lucide-react';
import api from '@/lib/api';
import { queryClient } from '@/lib/queryClient';
import { toast } from '@/components/ui/Toast';

// Minimal browser CSV parser (handles quoted fields)
function parseCSV(text) {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const result = [];
  for (const line of lines) {
    if (!line.trim()) continue;
    const row = [];
    let field = '';
    let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQ) {
        if (ch === '"' && line[i + 1] === '"') { field += '"'; i++; }
        else if (ch === '"') { inQ = false; }
        else field += ch;
      } else {
        if (ch === '"') { inQ = true; }
        else if (ch === ',') { row.push(field.trim()); field = ''; }
        else field += ch;
      }
    }
    row.push(field.trim());
    result.push(row);
  }
  return result;
}

const PREVIEW_ROWS = 5;

export function CsvImportModal({ projectId, onClose }) {
  const [file, setFile]           = useState(null);
  const [preview, setPreview]     = useState(null); // { headers, rows }
  const [dragging, setDragging]   = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult]       = useState(null);  // { created, failed }
  const inputRef = useRef();

  function processFile(f) {
    if (!f || !f.name.endsWith('.csv')) {
      toast.error('Please select a .csv file');
      return;
    }
    setFile(f);
    setResult(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      const rows = parseCSV(e.target.result);
      if (rows.length < 2) { toast.error('CSV must have headers and at least one row'); return; }
      setPreview({ headers: rows[0], rows: rows.slice(1, 1 + PREVIEW_ROWS), total: rows.length - 1 });
    };
    reader.readAsText(f);
  }

  function onFileChange(e) { processFile(e.target.files[0]); }

  function onDrop(e) {
    e.preventDefault();
    setDragging(false);
    processFile(e.dataTransfer.files[0]);
  }

  async function handleImport() {
    if (!file) return;
    setImporting(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await api.post(`/projects/${projectId}/tasks/import`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setResult(res.data);
      queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
    } catch (err) {
      toast.error(err.response?.data?.error || 'Import failed');
    } finally {
      setImporting(false);
    }
  }

  function reset() {
    setFile(null);
    setPreview(null);
    setResult(null);
    if (inputRef.current) inputRef.current.value = '';
  }

  return (
    <Modal open onClose={onClose} title="Import Tasks from CSV" className="max-w-2xl">
      <div className="space-y-5">

        {/* Template hint */}
        <div className="text-xs text-gray-500 bg-gray-50 rounded-xl p-3 border border-gray-100 leading-relaxed">
          <strong className="text-gray-700">Expected columns:</strong> Title (required), Description,
          Status, Priority, Assignee, Deadline, Estimated Hours
          <br />
          Status values: <code className="bg-white px-1 rounded">todo</code>, <code className="bg-white px-1 rounded">in_progress</code>, <code className="bg-white px-1 rounded">review</code>, <code className="bg-white px-1 rounded">done</code>
          &nbsp;·&nbsp;
          Priority: <code className="bg-white px-1 rounded">low</code>, <code className="bg-white px-1 rounded">medium</code>, <code className="bg-white px-1 rounded">high</code>, <code className="bg-white px-1 rounded">critical</code>
          &nbsp;·&nbsp;
          Assignee: name or email of a project member
          &nbsp;·&nbsp;
          Deadline: YYYY-MM-DD or MM/DD/YYYY
        </div>

        {/* Drop zone */}
        {!preview && (
          <div
            className={cn(
              'border-2 border-dashed rounded-xl p-10 text-center transition-colors cursor-pointer',
              dragging ? 'border-indigo-400 bg-indigo-50' : 'border-gray-200 hover:border-indigo-300 hover:bg-gray-50'
            )}
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
          >
            <Upload size={28} className="mx-auto text-gray-300 mb-3" />
            <p className="text-sm font-medium text-gray-600">Drop a CSV file here, or click to browse</p>
            <p className="text-xs text-gray-400 mt-1">Max 5 MB</p>
            <input ref={inputRef} type="file" accept=".csv" className="hidden" onChange={onFileChange} />
          </div>
        )}

        {/* Preview */}
        {preview && !result && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <FileText size={15} className="text-indigo-500" />
                <span className="text-sm font-semibold text-gray-800">{file.name}</span>
                <span className="text-xs text-gray-400">{preview.total} row{preview.total !== 1 ? 's' : ''} to import</span>
              </div>
              <button onClick={reset} className="text-gray-400 hover:text-gray-600 transition-colors">
                <X size={15} />
              </button>
            </div>

            <div className="overflow-x-auto rounded-xl border border-gray-200">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    {preview.headers.map((h, i) => (
                      <th key={i} className="px-3 py-2 text-left font-semibold text-gray-600 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {preview.rows.map((row, ri) => (
                    <tr key={ri} className="hover:bg-gray-50">
                      {row.map((cell, ci) => (
                        <td key={ci} className="px-3 py-2 text-gray-700 max-w-[200px] truncate" title={cell}>{cell}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {preview.total > PREVIEW_ROWS && (
              <p className="text-xs text-gray-400 mt-1.5 text-center">
                Showing first {PREVIEW_ROWS} of {preview.total} rows
              </p>
            )}
          </div>
        )}

        {/* Result */}
        {result && (
          <div className="space-y-3">
            <div className="flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
              <CheckCircle2 size={20} className="text-emerald-500 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-emerald-800">
                  {result.created} task{result.created !== 1 ? 's' : ''} imported successfully
                </p>
                {result.failed.length > 0 && (
                  <p className="text-xs text-emerald-600">{result.failed.length} row{result.failed.length !== 1 ? 's' : ''} skipped</p>
                )}
              </div>
            </div>

            {result.failed.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3">
                <div className="flex items-center gap-2 mb-2">
                  <AlertCircle size={14} className="text-red-500" />
                  <p className="text-xs font-semibold text-red-700">Skipped rows</p>
                </div>
                <div className="space-y-1">
                  {result.failed.map((f, i) => (
                    <p key={i} className="text-xs text-red-600">
                      Row {f.row}{f.title ? ` "${f.title}"` : ''}: {f.error}
                    </p>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-1">
          {result ? (
            <>
              <Button variant="secondary" onClick={reset}>Import another file</Button>
              <Button onClick={onClose}>Done</Button>
            </>
          ) : (
            <>
              <Button variant="secondary" onClick={onClose}>Cancel</Button>
              <Button
                onClick={handleImport}
                disabled={!preview || importing}
              >
                {importing ? 'Importing…' : `Import ${preview ? preview.total + ' task' + (preview.total !== 1 ? 's' : '') : ''}`}
              </Button>
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}
