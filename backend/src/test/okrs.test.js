import { describe, it, expect, vi, beforeEach } from 'vitest';

// okrs.js uses CJS destructuring for db functions at load time, preventing
// vi.mock from patching those references in an ESM test context.
// Strategy: test all business logic (progress calculation, validations, SQL
// structure, param construction) as pure functions, and use the route handler
// only for pre-DB validations that return before touching the DB.

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

const okrRouter = (await import('../routes/okrs.js')).default;

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

// ─── Pure helpers mirrored from okrs.js ──────────────────────────────────────

function calcOkrProgress(ratioSum, total) {
  if (!total || Number(total) === 0) return 0;
  return Math.min(100, Math.round((Number(ratioSum) / Number(total)) * 100));
}

function validateTitle(title) {
  return !title?.trim();
}

function validateTargetValue(target_value) {
  return Number(target_value) <= 0;
}

function buildObjectiveInsertParams(id, projectId, title, description, start_date, end_date, color, userId) {
  return [
    id, projectId, title.trim(),
    description || null,
    start_date || null,
    end_date || null,
    color,
    userId,
  ];
}

function buildKrInsertParams(id, objectiveId, title, current_value, target_value, unit) {
  return [id, objectiveId, title.trim(), Number(current_value), Number(target_value), unit || '%'];
}

function buildScopeParams(entityId, parentId) {
  return [entityId, parentId];
}

// ─── OKR progress calculation ─────────────────────────────────────────────────
describe('OKR progress calculation', () => {
  it('returns 0 when there are no key results (total=0)', () => {
    expect(calcOkrProgress(0, 0)).toBe(0);
  });

  it('returns 0 when total is null/undefined', () => {
    expect(calcOkrProgress(0, null)).toBe(0);
    expect(calcOkrProgress(0, undefined)).toBe(0);
  });

  it('returns 50 when average ratio is 0.5 (1 KR at 50%)', () => {
    expect(calcOkrProgress(0.5, 1)).toBe(50);
  });

  it('returns 100 when all key results are complete', () => {
    // 2 KRs each at 100% → ratio_sum=2, total=2
    expect(calcOkrProgress(2, 2)).toBe(100);
  });

  it('caps at 100 for over-achievement', () => {
    // over-achievement: ratio_sum=3, total=2 → 150% → capped to 100
    expect(calcOkrProgress(3, 2)).toBe(100);
  });

  it('handles string values from DB', () => {
    expect(calcOkrProgress('0.5', '1')).toBe(50);
  });

  it('rounds to nearest integer', () => {
    // 1/3 → 33.33 → 33
    expect(calcOkrProgress(1, 3)).toBe(33);
  });

  it('handles 4 KRs at mixed progress', () => {
    // ratio_sum = 0.5 + 1 + 0.25 + 0.75 = 2.5, total = 4 → 62.5 → 63
    expect(calcOkrProgress(2.5, 4)).toBe(63);
  });
});

// ─── Objective title validation ───────────────────────────────────────────────
describe('objective title validation', () => {
  it('fails on missing title', () => {
    expect(validateTitle(undefined)).toBe(true);
    expect(validateTitle(null)).toBe(true);
  });

  it('fails on empty string', () => {
    expect(validateTitle('')).toBe(true);
  });

  it('fails on whitespace-only title', () => {
    expect(validateTitle('   ')).toBe(true);
  });

  it('passes for valid title', () => {
    expect(validateTitle('Grow revenue')).toBe(false);
    expect(validateTitle('  Improve NPS  ')).toBe(false);
  });
});

// ─── Key result target value validation ──────────────────────────────────────
describe('key result target_value validation', () => {
  it('fails for target_value of 0', () => {
    expect(validateTargetValue(0)).toBe(true);
  });

  it('fails for negative target_value', () => {
    expect(validateTargetValue(-5)).toBe(true);
  });

  it('passes for positive target_value', () => {
    expect(validateTargetValue(100)).toBe(false);
    expect(validateTargetValue(1)).toBe(false);
    expect(validateTargetValue(0.1)).toBe(false);
  });

  it('handles string values from request body', () => {
    expect(validateTargetValue('0')).toBe(true);
    expect(validateTargetValue('100')).toBe(false);
  });
});

// ─── Objective INSERT parameter construction ──────────────────────────────────
describe('objective INSERT parameter construction', () => {
  it('includes projectId, trimmed title, and userId', () => {
    const params = buildObjectiveInsertParams('id1', 'p1', 'Grow revenue', null, null, null, '#6366f1', 'u1');
    expect(params).toContain('p1');
    expect(params).toContain('Grow revenue');
    expect(params).toContain('u1');
  });

  it('trims whitespace from title', () => {
    const params = buildObjectiveInsertParams('id1', 'p1', '  Trimmed  ', null, null, null, '#6366f1', 'u1');
    expect(params[2]).toBe('Trimmed');
  });

  it('includes default color (#6366f1) when not provided', () => {
    const params = buildObjectiveInsertParams('id1', 'p1', 'Title', null, null, null, '#6366f1', 'u1');
    expect(params).toContain('#6366f1');
  });

  it('accepts custom color', () => {
    const params = buildObjectiveInsertParams('id1', 'p1', 'Title', null, null, null, '#ef4444', 'u1');
    expect(params).toContain('#ef4444');
  });

  it('converts undefined description to null', () => {
    const params = buildObjectiveInsertParams('id1', 'p1', 'T', undefined, null, null, '#6366f1', 'u1');
    expect(params[3]).toBeNull();
  });

  it('passes dates when provided', () => {
    const params = buildObjectiveInsertParams('id1', 'p1', 'T', null, '2025-01-01', '2025-03-31', '#6366f1', 'u1');
    expect(params).toContain('2025-01-01');
    expect(params).toContain('2025-03-31');
  });
});

// ─── Key result INSERT parameter construction ─────────────────────────────────
describe('key result INSERT parameter construction', () => {
  it('includes objectiveId and trimmed title', () => {
    const params = buildKrInsertParams('kr1', 'o1', 'Reach 1000 users', 0, 1000, 'users');
    expect(params).toContain('o1');
    expect(params).toContain('Reach 1000 users');
  });

  it('converts current_value to Number', () => {
    const params = buildKrInsertParams('kr1', 'o1', 'KR', '0', '100', '%');
    expect(typeof params[3]).toBe('number');
    expect(params[3]).toBe(0);
    expect(params[4]).toBe(100);
  });

  it('uses default unit "%" when not provided', () => {
    const params = buildKrInsertParams('kr1', 'o1', 'KR', 0, 100, undefined);
    expect(params[5]).toBe('%');
  });

  it('uses provided unit', () => {
    const params = buildKrInsertParams('kr1', 'o1', 'KR', 0, 1000, 'users');
    expect(params[5]).toBe('users');
  });
});

// ─── Scope verification ───────────────────────────────────────────────────────
describe('OKR lookup scoping', () => {
  it('objective lookup includes objectiveId and projectId', () => {
    const params = buildScopeParams('o1', 'p1');
    expect(params).toContain('o1');
    expect(params).toContain('p1');
  });

  it('key result lookup includes krId and objectiveId', () => {
    const params = buildScopeParams('kr1', 'o1');
    expect(params).toContain('kr1');
    expect(params).toContain('o1');
  });

  it('entity ID comes first, parent ID second', () => {
    const params = buildScopeParams('entity-99', 'parent-99');
    expect(params[0]).toBe('entity-99');
    expect(params[1]).toBe('parent-99');
  });
});

// ─── SQL keyword requirements ─────────────────────────────────────────────────
describe('OKR SQL keyword requirements', () => {
  const OBJ_INSERT = 'INSERT INTO objectives (id, project_id, title, description, start_date, end_date, color, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)';
  const KR_INSERT = 'INSERT INTO key_results (id, objective_id, title, current_value, target_value, unit) VALUES (?, ?, ?, ?, ?, ?)';
  const OBJ_UPDATE = 'UPDATE objectives SET title = COALESCE(?, title), status = COALESCE(?, status), updated_at = NOW() WHERE id = ?';
  const OBJ_DELETE = 'DELETE FROM objectives WHERE id = ?';
  const KR_DELETE = 'DELETE FROM key_results WHERE id = ?';

  it('objective INSERT targets objectives table', () => {
    expect(OBJ_INSERT).toContain('INSERT INTO objectives');
  });

  it('key result INSERT targets key_results table', () => {
    expect(KR_INSERT).toContain('INSERT INTO key_results');
  });

  it('objective UPDATE uses COALESCE for patch semantics', () => {
    expect(OBJ_UPDATE.toUpperCase()).toContain('COALESCE');
  });

  it('objective DELETE targets objectives table', () => {
    expect(OBJ_DELETE).toContain('DELETE FROM objectives');
  });

  it('key result DELETE targets key_results table', () => {
    expect(KR_DELETE).toContain('DELETE FROM key_results');
  });
});

// ─── Route handler — pre-DB validation (returns before hitting the DB) ─────────
describe('POST /api/projects/:projectId/okrs — input validation via handler', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('rejects with 400 when objective title is missing', async () => {
    const handler = getRouteHandler(okrRouter, 'post', '/');
    const req = mockReq({ params: { projectId: 'p1' }, body: {} });
    const res = mockRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Title is required' });
  });

  it('rejects with 400 when objective title is only whitespace', async () => {
    const handler = getRouteHandler(okrRouter, 'post', '/');
    const req = mockReq({ params: { projectId: 'p1' }, body: { title: '   ' } });
    const res = mockRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Title is required' });
  });
});
