import { useState } from 'react';
import { useCustomFields, useCustomFieldValues, useUpsertCustomFieldValue } from '@/hooks/useCustomFields';
import { cn } from '@/lib/utils';
import { ExternalLink, Settings } from 'lucide-react';

// ─── Field value renderers ────────────────────────────────────────────────────

function TextField({ field, value, onSave }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? '');

  function commit() {
    onSave(draft);
    setEditing(false);
  }

  if (editing) {
    return (
      <input
        autoFocus
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit();
          if (e.key === 'Escape') { setDraft(value ?? ''); setEditing(false); }
        }}
        className="w-full text-sm border border-indigo-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
      />
    );
  }

  return (
    <button
      onClick={() => { setDraft(value ?? ''); setEditing(true); }}
      className={cn(
        'text-sm text-left w-full px-2.5 py-1.5 rounded-lg border border-transparent hover:border-indigo-200 hover:bg-indigo-50 transition-colors',
        value ? 'text-gray-800' : 'text-gray-400 italic'
      )}
    >
      {value || 'Click to edit…'}
    </button>
  );
}

function NumberField({ field, value, onSave }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? '');

  function commit() {
    const num = draft === '' ? null : Number(draft);
    onSave(isNaN(num) ? null : num);
    setEditing(false);
  }

  if (editing) {
    return (
      <input
        autoFocus
        type="number"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit();
          if (e.key === 'Escape') { setDraft(value ?? ''); setEditing(false); }
        }}
        className="w-full text-sm border border-indigo-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
      />
    );
  }

  return (
    <button
      onClick={() => { setDraft(value ?? ''); setEditing(true); }}
      className={cn(
        'text-sm text-left w-full px-2.5 py-1.5 rounded-lg border border-transparent hover:border-indigo-200 hover:bg-indigo-50 transition-colors',
        value != null ? 'text-gray-800 font-medium' : 'text-gray-400 italic'
      )}
    >
      {value != null ? String(value) : 'Click to set…'}
    </button>
  );
}

function SelectField({ field, value, onSave }) {
  const options = field.options ?? [];

  return (
    <select
      value={value ?? ''}
      onChange={(e) => onSave(e.target.value || null)}
      className="w-full text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
    >
      <option value="">— None —</option>
      {options.map((opt) => (
        <option key={opt} value={opt}>{opt}</option>
      ))}
    </select>
  );
}

function DateField({ field, value, onSave }) {
  return (
    <input
      type="date"
      value={value ? String(value).slice(0, 10) : ''}
      onChange={(e) => onSave(e.target.value || null)}
      className="w-full text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
    />
  );
}

function CheckboxField({ field, value, onSave }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer group">
      <input
        type="checkbox"
        checked={!!value}
        onChange={(e) => onSave(e.target.checked)}
        className="w-4 h-4 rounded accent-indigo-600 cursor-pointer"
      />
      <span className={cn('text-sm', value ? 'text-gray-800 font-medium' : 'text-gray-400')}>
        {value ? 'Yes' : 'No'}
      </span>
    </label>
  );
}

function UrlField({ field, value, onSave }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? '');

  function commit() {
    onSave(draft.trim() || null);
    setEditing(false);
  }

  if (editing) {
    return (
      <input
        autoFocus
        type="url"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit();
          if (e.key === 'Escape') { setDraft(value ?? ''); setEditing(false); }
        }}
        placeholder="https://…"
        className="w-full text-sm border border-indigo-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
      />
    );
  }

  if (value) {
    return (
      <div className="flex items-center gap-1.5">
        <a
          href={value}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-indigo-600 hover:underline truncate flex items-center gap-1"
          onClick={(e) => e.stopPropagation()}
        >
          <ExternalLink size={12} className="shrink-0" />
          {value}
        </a>
        <button
          onClick={() => { setDraft(value); setEditing(true); }}
          className="text-xs text-gray-400 hover:text-gray-600 shrink-0 ml-auto"
        >
          Edit
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => { setDraft(''); setEditing(true); }}
      className="text-sm text-left w-full px-2.5 py-1.5 rounded-lg border border-transparent hover:border-indigo-200 hover:bg-indigo-50 transition-colors text-gray-400 italic"
    >
      Click to add URL…
    </button>
  );
}

// ─── Field router ─────────────────────────────────────────────────────────────

function FieldValue({ field, value, onSave }) {
  const props = { field, value, onSave };
  switch (field.type) {
    case 'text':     return <TextField     {...props} />;
    case 'number':   return <NumberField   {...props} />;
    case 'select':   return <SelectField   {...props} />;
    case 'date':     return <DateField     {...props} />;
    case 'checkbox': return <CheckboxField {...props} />;
    case 'url':      return <UrlField      {...props} />;
    default:
      return <span className="text-sm text-gray-400 italic">Unsupported type: {field.type}</span>;
  }
}

// ─── Individual field row ─────────────────────────────────────────────────────

function FieldRow({ field, taskId, valueMap }) {
  const upsert = useUpsertCustomFieldValue(taskId, field.id);
  const currentValue = valueMap[field.id] ?? null;

  function handleSave(val) {
    // Avoid no-op writes
    if (val === currentValue) return;
    upsert.mutate(val);
  }

  return (
    <div className="flex items-start gap-3">
      <div className="w-32 shrink-0 pt-1.5">
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide leading-none">
          {field.name}
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <FieldValue field={field} value={currentValue} onSave={handleSave} />
      </div>
      {upsert.isPending && (
        <div className="w-3 h-3 rounded-full border-2 border-indigo-400 border-t-transparent animate-spin mt-2 shrink-0" />
      )}
    </div>
  );
}

// ─── Main exported panel ──────────────────────────────────────────────────────

export function CustomFieldsPanel({ projectId, taskId }) {
  const { data: fields = [], isLoading: fieldsLoading } = useCustomFields(projectId);
  const { data: valuesRaw = [], isLoading: valuesLoading } = useCustomFieldValues(taskId);

  // Normalize values to a fieldId → value map
  const valueMap = Array.isArray(valuesRaw)
    ? Object.fromEntries(valuesRaw.map((v) => [String(v.field_id ?? v.custom_field_id), v.value]))
    : valuesRaw;

  const isLoading = fieldsLoading || valuesLoading;
  const fieldList = Array.isArray(fields) ? fields : (fields?.fields ?? []);

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-8 bg-gray-100 rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  if (fieldList.length === 0) {
    return (
      <div className="flex items-start gap-2.5 p-3 bg-gray-50 rounded-xl border border-gray-100 text-sm text-gray-400">
        <Settings size={14} className="mt-0.5 shrink-0 text-gray-300" />
        <span>
          No custom fields.{' '}
          <span className="text-indigo-500">Set up in project settings.</span>
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {fieldList.map((field) => (
        <FieldRow
          key={field.id}
          field={field}
          taskId={taskId}
          valueMap={valueMap}
        />
      ))}
    </div>
  );
}
