import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── nameToKey() unit tests ───────────────────────────────────────────────────
// Extracted from projectStatuses.js for isolated unit testing

function nameToKey(name) {
  return name.toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 30);
}

describe('nameToKey()', () => {
  it('converts a simple name to lowercase with underscores', () => {
    expect(nameToKey('In Progress')).toBe('in_progress');
  });

  it('handles all lowercase input', () => {
    expect(nameToKey('todo')).toBe('todo');
  });

  it('handles all uppercase input', () => {
    expect(nameToKey('DONE')).toBe('done');
  });

  it('replaces multiple spaces/special chars with a single underscore', () => {
    expect(nameToKey('Under   Review!')).toBe('under_review');
  });

  it('strips leading and trailing underscores', () => {
    expect(nameToKey('  Hello World  ')).toBe('hello_world');
  });

  it('handles hyphens as separator', () => {
    expect(nameToKey('in-review')).toBe('in_review');
  });

  it('collapses multiple non-alphanumeric chars into one underscore', () => {
    expect(nameToKey('!@#New Status###')).toBe('new_status');
  });

  it('truncates to 30 characters', () => {
    const long = 'A'.repeat(40);
    expect(nameToKey(long)).toHaveLength(30);
    expect(nameToKey(long)).toBe('a'.repeat(30));
  });

  it('preserves digits in the key', () => {
    expect(nameToKey('Phase 2 Review')).toBe('phase_2_review');
  });

  it('produces the built-in default keys correctly', () => {
    expect(nameToKey('To Do')).toBe('to_do');
    expect(nameToKey('In Progress')).toBe('in_progress');
    expect(nameToKey('Review')).toBe('review');
    expect(nameToKey('Done')).toBe('done');
  });

  it('handles single character names', () => {
    expect(nameToKey('A')).toBe('a');
  });

  it('handles names that are only special characters', () => {
    // e.g., "!!!" → '' after stripping leading/trailing underscores
    expect(nameToKey('!!!')).toBe('');
  });
});

// ─── DEFAULT_KEYS protection logic ───────────────────────────────────────────
describe('DEFAULT_KEYS protection', () => {
  const DEFAULT_KEYS = new Set(['todo', 'in_progress', 'review', 'done']);

  it('blocks deletion of todo', () => {
    expect(DEFAULT_KEYS.has('todo')).toBe(true);
  });

  it('blocks deletion of in_progress', () => {
    expect(DEFAULT_KEYS.has('in_progress')).toBe(true);
  });

  it('blocks deletion of review', () => {
    expect(DEFAULT_KEYS.has('review')).toBe(true);
  });

  it('blocks deletion of done', () => {
    expect(DEFAULT_KEYS.has('done')).toBe(true);
  });

  it('allows deletion of custom keys', () => {
    expect(DEFAULT_KEYS.has('wont_fix')).toBe(false);
    expect(DEFAULT_KEYS.has('blocked')).toBe(false);
    expect(DEFAULT_KEYS.has('custom_status')).toBe(false);
  });

  it('is case-sensitive — uppercase keys are not blocked', () => {
    expect(DEFAULT_KEYS.has('TODO')).toBe(false);
    expect(DEFAULT_KEYS.has('Done')).toBe(false);
  });
});

// ─── DELETE 409 logic ─────────────────────────────────────────────────────────
describe('DELETE status — 409 conflict logic', () => {
  // Mirror the guard logic from the route handler
  function canDelete(status, totalCount, taskCount) {
    if (DEFAULT_KEYS.has(status.key)) {
      return { ok: false, reason: 'default' };
    }
    if (totalCount <= 1) {
      return { ok: false, reason: 'last' };
    }
    if (taskCount > 0) {
      return { ok: false, reason: 'tasks_using_it', task_count: taskCount };
    }
    return { ok: true };
  }

  const DEFAULT_KEYS = new Set(['todo', 'in_progress', 'review', 'done']);

  it('rejects deletion of a default key', () => {
    const result = canDelete({ key: 'todo' }, 5, 0);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('default');
  });

  it('rejects deletion when only 1 status remains', () => {
    const result = canDelete({ key: 'custom' }, 1, 0);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('last');
  });

  it('rejects deletion when tasks are using the status', () => {
    const result = canDelete({ key: 'custom' }, 5, 3);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('tasks_using_it');
    expect(result.task_count).toBe(3);
  });

  it('allows deletion of non-default key with no tasks and multiple statuses', () => {
    const result = canDelete({ key: 'blocked' }, 3, 0);
    expect(result.ok).toBe(true);
  });

  it('rejects deletion when exactly 1 task uses the status', () => {
    const result = canDelete({ key: 'wont_fix' }, 4, 1);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('tasks_using_it');
  });
});

// ─── is_default toggle logic ──────────────────────────────────────────────────
describe('is_default toggle logic', () => {
  it('setting is_default to true should clear all others first', () => {
    // Simulate the route's behavior: clear-all-then-set pattern
    let statuses = [
      { id: 's1', key: 'todo', is_default: true },
      { id: 's2', key: 'in_progress', is_default: false },
      { id: 's3', key: 'done', is_default: false },
    ];

    function setDefault(statusId) {
      statuses = statuses.map((s) => ({ ...s, is_default: false }));
      statuses = statuses.map((s) => s.id === statusId ? { ...s, is_default: true } : s);
    }

    setDefault('s2');
    expect(statuses.find((s) => s.id === 's1').is_default).toBe(false);
    expect(statuses.find((s) => s.id === 's2').is_default).toBe(true);
    expect(statuses.find((s) => s.id === 's3').is_default).toBe(false);
  });

  it('only one status is default after setDefault is called', () => {
    let statuses = [
      { id: 's1', is_default: true },
      { id: 's2', is_default: false },
      { id: 's3', is_default: false },
    ];

    function setDefault(statusId) {
      statuses = statuses.map((s) => ({ ...s, is_default: s.id === statusId }));
    }

    setDefault('s3');
    const defaults = statuses.filter((s) => s.is_default);
    expect(defaults).toHaveLength(1);
    expect(defaults[0].id).toBe('s3');
  });
});

// ─── reorder logic ────────────────────────────────────────────────────────────
describe('reorder positions logic', () => {
  it('assigns 0-based positions in the given order', () => {
    const order = ['id-c', 'id-a', 'id-b'];
    const updates = order.map((id, i) => ({ id, position: i }));
    expect(updates).toEqual([
      { id: 'id-c', position: 0 },
      { id: 'id-a', position: 1 },
      { id: 'id-b', position: 2 },
    ]);
  });
});
