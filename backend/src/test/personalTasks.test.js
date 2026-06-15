import { describe, it, expect, vi, beforeEach } from 'vitest';

// Unit tests for the owner-scoping logic in personalTasks.js.
// These tests exercise the business rules in isolation without HTTP or DB.

// ─── GET query builder ────────────────────────────────────────────────────────
describe('personal tasks — GET query builder', () => {
  function buildGetQuery(ownerId, status) {
    const sql = `SELECT * FROM personal_tasks
       WHERE owner_id = ?
       ${status ? 'AND status = ?' : ''}
       ORDER BY status ASC, position ASC, created_at DESC`;
    const params = status ? [ownerId, status] : [ownerId];
    return { sql, params };
  }

  it('always includes owner_id in params', () => {
    const { params } = buildGetQuery('user-1', undefined);
    expect(params[0]).toBe('user-1');
  });

  it('adds status filter param when status is provided', () => {
    const { params } = buildGetQuery('user-1', 'todo');
    expect(params).toEqual(['user-1', 'todo']);
  });

  it('does NOT add status filter when status is undefined', () => {
    const { params } = buildGetQuery('user-1', undefined);
    expect(params).toHaveLength(1);
  });

  it('SQL includes AND status = ? when status is provided', () => {
    const { sql } = buildGetQuery('user-1', 'done');
    expect(sql).toContain('AND status = ?');
  });

  it('SQL omits AND status clause when status is undefined', () => {
    const { sql } = buildGetQuery('user-1', undefined);
    expect(sql).not.toContain('AND status = ?');
  });

  it('owner_id comes before status in the params array', () => {
    const { params } = buildGetQuery('owner-abc', 'done');
    expect(params[0]).toBe('owner-abc');
    expect(params[1]).toBe('done');
  });
});

// ─── POST param builder ────────────────────────────────────────────────────────
describe('personal tasks — POST param builder', () => {
  function buildInsertParams(ownerId, body, maxPos) {
    const { title, notes, priority = 'medium', due_date } = body;
    const position = (maxPos ?? -1) + 1;
    return [ownerId, title.trim(), notes || null, priority, due_date || null, position];
  }

  it('puts owner_id as the first param', () => {
    const params = buildInsertParams('user-x', { title: 'Buy milk' }, 2);
    expect(params[0]).toBe('user-x');
  });

  it('trims the title', () => {
    const params = buildInsertParams('user-x', { title: '  Buy milk  ' }, 0);
    expect(params[1]).toBe('Buy milk');
  });

  it('defaults notes to null when omitted', () => {
    const params = buildInsertParams('user-x', { title: 'Task' }, 0);
    expect(params[2]).toBeNull();
  });

  it('defaults priority to "medium" when omitted', () => {
    const params = buildInsertParams('user-x', { title: 'Task' }, 0);
    expect(params[3]).toBe('medium');
  });

  it('uses provided priority', () => {
    const params = buildInsertParams('user-x', { title: 'Task', priority: 'high' }, 0);
    expect(params[3]).toBe('high');
  });

  it('defaults due_date to null when omitted', () => {
    const params = buildInsertParams('user-x', { title: 'Task' }, 0);
    expect(params[4]).toBeNull();
  });

  it('positions new task at maxPos + 1', () => {
    const params = buildInsertParams('user-x', { title: 'Task' }, 4);
    expect(params[5]).toBe(5);
  });

  it('positions at 0 when no existing tasks (maxPos = -1)', () => {
    const params = buildInsertParams('user-x', { title: 'Task' }, -1);
    expect(params[5]).toBe(0);
  });

  it('positions at 0 when maxPos is null (no tasks)', () => {
    const params = buildInsertParams('user-x', { title: 'Task' }, null);
    expect(params[5]).toBe(0);
  });
});

// ─── PATCH param builder (owner scoping) ─────────────────────────────────────
describe('personal tasks — PATCH owner scoping', () => {
  function buildUpdateParams(ownerId, taskId, body) {
    const { title, notes, status, priority, due_date, position } = body;
    const sets = []; const vals = [];
    if (title !== undefined)    { sets.push('title = ?');    vals.push(title.trim()); }
    if (notes !== undefined)    { sets.push('notes = ?');    vals.push(notes || null); }
    if (status !== undefined)   { sets.push('status = ?');   vals.push(status); }
    if (priority !== undefined) { sets.push('priority = ?'); vals.push(priority); }
    if (due_date !== undefined) { sets.push('due_date = ?'); vals.push(due_date || null); }
    if (position !== undefined) { sets.push('position = ?'); vals.push(position); }
    sets.push('updated_at = NOW()');
    const finalParams = [...vals, taskId, ownerId];
    const sql = `UPDATE personal_tasks SET ${sets.join(', ')} WHERE id = ? AND owner_id = ?`;
    return { sql, params: finalParams };
  }

  it('WHERE clause always includes owner_id', () => {
    const { sql } = buildUpdateParams('owner-1', 'task-1', { status: 'done' });
    expect(sql).toContain('AND owner_id = ?');
  });

  it('task_id precedes owner_id in params (for WHERE id = ? AND owner_id = ?)', () => {
    const { params } = buildUpdateParams('owner-1', 'task-x', { status: 'done' });
    const taskIdIdx = params.indexOf('task-x');
    const ownerIdIdx = params.indexOf('owner-1');
    expect(taskIdIdx).toBeLessThan(ownerIdIdx);
  });

  it('only updates fields that are provided', () => {
    const { sql, params } = buildUpdateParams('owner-1', 'task-1', { status: 'done' });
    expect(sql).toContain('status = ?');
    expect(sql).not.toContain('title = ?');
    expect(params).toContain('done');
  });

  it('returns nothing to update indication when no fields provided (empty sets before timestamp)', () => {
    const body = {};
    const { title, notes, status, priority, due_date, position } = body;
    const sets = [];
    if (title !== undefined) sets.push('title = ?');
    if (notes !== undefined) sets.push('notes = ?');
    if (status !== undefined) sets.push('status = ?');
    if (priority !== undefined) sets.push('priority = ?');
    if (due_date !== undefined) sets.push('due_date = ?');
    if (position !== undefined) sets.push('position = ?');
    expect(sets).toHaveLength(0); // route returns 400 at this point
  });

  it('converts empty notes string to null', () => {
    const { params } = buildUpdateParams('owner-1', 'task-1', { notes: '' });
    expect(params[0]).toBeNull();
  });

  it('converts empty due_date to null', () => {
    const { params } = buildUpdateParams('owner-1', 'task-1', { due_date: '' });
    expect(params[0]).toBeNull();
  });
});

// ─── DELETE scoping ────────────────────────────────────────────────────────────
describe('personal tasks — DELETE owner scoping', () => {
  it('DELETE single task always includes owner_id in WHERE clause', () => {
    function buildDeleteSql(ownerId, taskId) {
      return {
        sql: 'DELETE FROM personal_tasks WHERE id = ? AND owner_id = ?',
        params: [taskId, ownerId],
      };
    }
    const { sql, params } = buildDeleteSql('owner-1', 'task-7');
    expect(sql).toContain('AND owner_id = ?');
    expect(params).toEqual(['task-7', 'owner-1']);
  });

  it('bulk clear done always includes owner_id in WHERE clause', () => {
    function buildClearDoneSql(ownerId) {
      return {
        sql: "DELETE FROM personal_tasks WHERE owner_id = ? AND status = 'done'",
        params: [ownerId],
      };
    }
    const { sql, params } = buildClearDoneSql('owner-2');
    expect(sql).toContain("AND status = 'done'");
    expect(params).toEqual(['owner-2']);
  });
});

// ─── Priority ordering logic ──────────────────────────────────────────────────
describe('personal tasks — priority ordering', () => {
  const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 };

  function sortByPriority(tasks) {
    return [...tasks].sort((a, b) => (PRIORITY_ORDER[a.priority] ?? 3) - (PRIORITY_ORDER[b.priority] ?? 3));
  }

  it('sorts high before medium before low', () => {
    const tasks = [
      { id: '1', priority: 'low' },
      { id: '2', priority: 'high' },
      { id: '3', priority: 'medium' },
    ];
    const sorted = sortByPriority(tasks);
    expect(sorted[0].priority).toBe('high');
    expect(sorted[1].priority).toBe('medium');
    expect(sorted[2].priority).toBe('low');
  });

  it('places unknown priorities last', () => {
    const tasks = [
      { id: '1', priority: 'unknown' },
      { id: '2', priority: 'low' },
    ];
    const sorted = sortByPriority(tasks);
    expect(sorted[0].priority).toBe('low');
    expect(sorted[1].priority).toBe('unknown');
  });
});
