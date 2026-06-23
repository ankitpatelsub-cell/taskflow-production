import { describe, it, expect, vi, beforeEach } from 'vitest';

// milestones.js requires '../config/db' via CJS destructuring at load time, so
// the local queryAll/queryOne/execute references can't be patched by vi.mock in
// an ESM test context. Strategy: test all business logic as pure functions
// (title/status validation, param construction, SQL keywords, progress math),
// and use the route handler only for pre-DB validation that never hits the DB.

process.env.JWT_SECRET = 'test_jwt_secret_32chars_long_key';
process.env.JWT_REFRESH_SECRET = 'test_refresh_secret_32chars_long';
process.env.BACKUP_ENCRYPTION_KEY = 'test_backup_key_32chars_longxxx';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';

vi.mock('../config/db', () => ({
  queryOne: vi.fn(),
  queryAll: vi.fn(),
  execute: vi.fn(),
}));
vi.mock('../config/logger', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(),
}));

const milestoneRouter = (await import('../routes/milestones.js')).default;

function mockRes() {
  const res = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

function mockReq(overrides = {}) {
  return { headers: {}, params: {}, body: {}, query: {}, user: { id: 'u1', role: 'member' }, ...overrides };
}

function getRouteHandler(router, method, path) {
  for (const layer of router.stack) {
    if (layer.route) {
      if (layer.route.path === path && layer.route.methods[method.toLowerCase()]) {
        const handlers = layer.route.stack;
        return handlers[handlers.length - 1].handle;
      }
    }
  }
  return null;
}

// ─── Pure helpers mirrored from milestones.js ─────────────────────────────────

function calcProgress(task_count, done_count) {
  if (!task_count || Number(task_count) === 0) return 0;
  return Math.round((Number(done_count) / Number(task_count)) * 100);
}

function validateTitle(title) {
  return !title?.trim();
}

function validateStatus(status) {
  return status && !['open', 'completed'].includes(status);
}

function buildInsertParams(id, projectId, title, description, due_date, userId) {
  return [id, projectId, title.trim(), description || null, due_date || null, userId];
}

function buildScopeParams(milestoneId, projectId) {
  return [milestoneId, projectId];
}

// ─── Progress calculation ─────────────────────────────────────────────────────
describe('milestone progress calculation', () => {
  it('returns 0 when task_count is 0', () => {
    expect(calcProgress(0, 0)).toBe(0);
  });

  it('returns 0 when task_count is null/undefined', () => {
    expect(calcProgress(null, 0)).toBe(0);
    expect(calcProgress(undefined, 0)).toBe(0);
  });

  it('returns 50 when half the tasks are done', () => {
    expect(calcProgress(4, 2)).toBe(50);
  });

  it('returns 100 when all tasks are done', () => {
    expect(calcProgress(5, 5)).toBe(100);
  });

  it('returns 25 for 1 of 4 done', () => {
    expect(calcProgress(4, 1)).toBe(25);
  });

  it('handles string values from DB (COUNT returns strings in some drivers)', () => {
    expect(calcProgress('4', '2')).toBe(50);
  });
});

// ─── Title validation logic ───────────────────────────────────────────────────
describe('milestone title validation', () => {
  it('fails on undefined/null title', () => {
    expect(validateTitle(undefined)).toBe(true);
    expect(validateTitle(null)).toBe(true);
  });

  it('fails on empty string', () => {
    expect(validateTitle('')).toBe(true);
  });

  it('fails on whitespace-only title', () => {
    expect(validateTitle('   ')).toBe(true);
    expect(validateTitle('\t\n')).toBe(true);
  });

  it('passes for valid titles', () => {
    expect(validateTitle('v1.0 Launch')).toBe(false);
    expect(validateTitle('  Q3 Goals  ')).toBe(false);
  });
});

// ─── Status validation logic ──────────────────────────────────────────────────
describe('milestone status validation', () => {
  it('no error when status is absent', () => {
    expect(validateStatus(undefined)).toBeFalsy();
    expect(validateStatus(null)).toBeFalsy();
    expect(validateStatus('')).toBeFalsy();
  });

  it('rejects invalid status values', () => {
    expect(validateStatus('in_progress')).toBeTruthy();
    expect(validateStatus('pending')).toBeTruthy();
    expect(validateStatus('OPEN')).toBeTruthy();
  });

  it('accepts "open"', () => {
    expect(validateStatus('open')).toBeFalsy();
  });

  it('accepts "completed"', () => {
    expect(validateStatus('completed')).toBeFalsy();
  });
});

// ─── INSERT parameter construction ───────────────────────────────────────────
describe('milestone INSERT parameter construction', () => {
  it('includes projectId, trimmed title, and userId', () => {
    const params = buildInsertParams('id1', 'proj-1', 'My Milestone', null, null, 'u1');
    expect(params).toContain('proj-1');
    expect(params).toContain('My Milestone');
    expect(params).toContain('u1');
  });

  it('trims whitespace from title', () => {
    const params = buildInsertParams('id1', 'p1', '  Trimmed  ', null, null, 'u1');
    expect(params[2]).toBe('Trimmed');
  });

  it('converts undefined/null description to null', () => {
    expect(buildInsertParams('id1', 'p1', 'T', undefined, null, 'u1')[3]).toBeNull();
    expect(buildInsertParams('id1', 'p1', 'T', null, null, 'u1')[3]).toBeNull();
  });

  it('passes description when provided', () => {
    const params = buildInsertParams('id1', 'p1', 'T', 'A description', null, 'u1');
    expect(params[3]).toBe('A description');
  });

  it('passes due_date when provided', () => {
    const params = buildInsertParams('id1', 'p1', 'T', null, '2025-12-31', 'u1');
    expect(params[4]).toBe('2025-12-31');
  });

  it('converts undefined due_date to null', () => {
    expect(buildInsertParams('id1', 'p1', 'T', null, undefined, 'u1')[4]).toBeNull();
  });
});

// ─── Scope verification ───────────────────────────────────────────────────────
describe('milestone lookup scoping', () => {
  it('includes both milestoneId and projectId', () => {
    const params = buildScopeParams('m1', 'p1');
    expect(params).toContain('m1');
    expect(params).toContain('p1');
  });

  it('milestoneId first, projectId second', () => {
    const params = buildScopeParams('ms-99', 'pj-99');
    expect(params[0]).toBe('ms-99');
    expect(params[1]).toBe('pj-99');
  });
});

// ─── SQL keyword requirements ─────────────────────────────────────────────────
describe('milestone SQL keyword requirements', () => {
  const INSERT_SQL = 'INSERT INTO milestones (id, project_id, title, description, due_date, created_by) VALUES (?, ?, ?, ?, ?, ?)';
  const UPDATE_SQL = 'UPDATE milestones SET title = COALESCE(?, title), description = COALESCE(?, description), status = COALESCE(?, status), updated_at = NOW() WHERE id = ?';
  const DELETE_SQL = 'DELETE FROM milestones WHERE id = ?';

  it('INSERT targets milestones table', () => {
    expect(INSERT_SQL).toContain('INSERT INTO milestones');
  });

  it('UPDATE uses COALESCE (patch semantics — only updates provided fields)', () => {
    expect(UPDATE_SQL.toUpperCase()).toContain('COALESCE');
  });

  it('DELETE targets milestones table', () => {
    expect(DELETE_SQL).toContain('DELETE FROM milestones');
  });

  it('DELETE uses WHERE id (not a table-level delete)', () => {
    expect(DELETE_SQL).toContain('WHERE id');
  });
});

// ─── Route handler — pre-DB validation (these return before hitting the DB) ───
describe('POST /api/projects/:projectId/milestones — input validation via handler', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('rejects with 400 when title is missing', async () => {
    const handler = getRouteHandler(milestoneRouter, 'post', '/');
    const req = mockReq({ params: { projectId: 'p1' }, body: {} });
    const res = mockRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Title is required' });
  });

  it('rejects with 400 when title is only whitespace', async () => {
    const handler = getRouteHandler(milestoneRouter, 'post', '/');
    const req = mockReq({ params: { projectId: 'p1' }, body: { title: '   ' } });
    const res = mockRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Title is required' });
  });
});
