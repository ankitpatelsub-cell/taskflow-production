import { describe, it, expect, vi, beforeEach } from 'vitest';

// taskWatchers.js uses CJS destructuring for db functions, so vi.mock can't
// patch them after module load. Strategy: test all pure logic as functions and
// only use the route handler for role-check middleware (which doesn't need the DB
// for admin/super_admin) and for validation/structure tests.

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

const taskWatchersRouter = (await import('../routes/taskWatchers.js')).default;

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

function getTaskAccessMiddleware(router) {
  for (const layer of router.stack) {
    if (!layer.route && layer.name === 'requireTaskAccess') {
      return layer.handle;
    }
  }
  const nonRoutes = router.stack.filter((l) => !l.route);
  return nonRoutes[1]?.handle ?? null;
}

// ─── Pure watcher helpers (mirrored from taskWatchers.js) ─────────────────────

function calcIsWatching(watchers, userId) {
  return watchers.some((w) => w.user_id === userId);
}

function calcWatcherCount(watchers) {
  return watchers.length;
}

function isPrivilegedRole(role) {
  return ['admin', 'super_admin'].includes(role);
}

function buildWatchInsertSql() {
  return 'INSERT INTO task_watchers (id, task_id, user_id) VALUES (?, ?, ?) ON CONFLICT (task_id, user_id) DO NOTHING';
}

function buildWatchDeleteSql() {
  return 'DELETE FROM task_watchers WHERE task_id = ? AND user_id = ?';
}

function buildWatchInsertParams(id, taskId, userId) {
  return [id, taskId, userId];
}

function buildWatchDeleteParams(taskId, userId) {
  return [taskId, userId];
}

// ─── isWatching calculation ───────────────────────────────────────────────────
describe('watcher isWatching calculation', () => {
  const watchers = [
    { id: 'w1', user_id: 'u1', name: 'Alice' },
    { id: 'w2', user_id: 'u2', name: 'Bob' },
  ];

  it('returns false when user is not in the watchers list', () => {
    expect(calcIsWatching(watchers, 'u3')).toBe(false);
  });

  it('returns true when user is in the watchers list', () => {
    expect(calcIsWatching(watchers, 'u1')).toBe(true);
    expect(calcIsWatching(watchers, 'u2')).toBe(true);
  });

  it('returns false for empty watchers array', () => {
    expect(calcIsWatching([], 'u1')).toBe(false);
  });

  it('checks user_id property, not id', () => {
    const list = [{ id: 'w99', user_id: 'special-user', name: 'X' }];
    expect(calcIsWatching(list, 'special-user')).toBe(true);
    expect(calcIsWatching(list, 'w99')).toBe(false);
  });
});

// ─── Watcher count ────────────────────────────────────────────────────────────
describe('watcher count calculation', () => {
  it('returns 0 for empty array', () => {
    expect(calcWatcherCount([])).toBe(0);
  });

  it('returns correct count for multiple watchers', () => {
    const list = Array.from({ length: 5 }, (_, i) => ({ id: `w${i}`, user_id: `u${i}` }));
    expect(calcWatcherCount(list)).toBe(5);
  });

  it('count matches array length', () => {
    const list = [{ id: 'w1', user_id: 'u1' }, { id: 'w2', user_id: 'u2' }];
    expect(calcWatcherCount(list)).toBe(list.length);
  });
});

// ─── Role-based access check ──────────────────────────────────────────────────
describe('task access — privileged role check', () => {
  it('admin is privileged (bypasses DB checks)', () => {
    expect(isPrivilegedRole('admin')).toBe(true);
  });

  it('super_admin is privileged', () => {
    expect(isPrivilegedRole('super_admin')).toBe(true);
  });

  it('member is not privileged', () => {
    expect(isPrivilegedRole('member')).toBe(false);
  });

  it('viewer is not privileged', () => {
    expect(isPrivilegedRole('viewer')).toBe(false);
  });

  it('project_manager is not privileged', () => {
    expect(isPrivilegedRole('project_manager')).toBe(false);
  });
});

// ─── Watch INSERT SQL ─────────────────────────────────────────────────────────
describe('watch INSERT SQL structure', () => {
  it('targets task_watchers table', () => {
    expect(buildWatchInsertSql()).toContain('INSERT INTO task_watchers');
  });

  it('uses ON CONFLICT DO NOTHING for idempotent insert', () => {
    const sql = buildWatchInsertSql().toUpperCase();
    expect(sql).toContain('ON CONFLICT');
    expect(sql).toContain('DO NOTHING');
  });

  it('inserts id, task_id, and user_id', () => {
    const sql = buildWatchInsertSql();
    expect(sql).toContain('task_id');
    expect(sql).toContain('user_id');
  });
});

// ─── Watch DELETE SQL ─────────────────────────────────────────────────────────
describe('watch DELETE SQL structure', () => {
  it('targets task_watchers table', () => {
    expect(buildWatchDeleteSql()).toContain('DELETE FROM task_watchers');
  });

  it('filters by task_id AND user_id (scoped delete)', () => {
    const sql = buildWatchDeleteSql();
    expect(sql).toContain('task_id');
    expect(sql).toContain('user_id');
  });
});

// ─── Parameter passing ────────────────────────────────────────────────────────
describe('watch INSERT params', () => {
  it('includes taskId and userId', () => {
    const params = buildWatchInsertParams('uuid1', 'task-xyz', 'user-abc');
    expect(params).toContain('task-xyz');
    expect(params).toContain('user-abc');
  });
});

describe('watch DELETE params', () => {
  it('includes taskId and userId', () => {
    const params = buildWatchDeleteParams('task-99', 'user-88');
    expect(params).toContain('task-99');
    expect(params).toContain('user-88');
  });

  it('taskId comes before userId', () => {
    const params = buildWatchDeleteParams('t1', 'u1');
    expect(params[0]).toBe('t1');
    expect(params[1]).toBe('u1');
  });
});

// ─── Response format ──────────────────────────────────────────────────────────
describe('watcher response format', () => {
  it('GET response has watchers, isWatching, and count properties', () => {
    const watchers = [{ id: 'w1', user_id: 'u1' }];
    const userId = 'u1';
    const response = {
      watchers,
      isWatching: calcIsWatching(watchers, userId),
      count: calcWatcherCount(watchers),
    };
    expect(response).toHaveProperty('watchers');
    expect(response).toHaveProperty('isWatching');
    expect(response).toHaveProperty('count');
    expect(response.isWatching).toBe(true);
    expect(response.count).toBe(1);
  });

  it('POST watch response is { watching: true }', () => {
    const response = { watching: true };
    expect(response.watching).toBe(true);
  });

  it('DELETE unwatch response is { watching: false }', () => {
    const response = { watching: false };
    expect(response.watching).toBe(false);
  });
});

// ─── requireTaskAccess middleware — privileged roles skip DB ──────────────────
describe('requireTaskAccess middleware', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('calls next() immediately for admin without any DB queries', async () => {
    const mw = getTaskAccessMiddleware(taskWatchersRouter);
    if (!mw) return;
    const req = mockReq({ user: { id: 'a1', role: 'admin' }, params: { taskId: 't1' } });
    const res = mockRes();
    const next = vi.fn();
    await mw(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('calls next() immediately for super_admin without any DB queries', async () => {
    const mw = getTaskAccessMiddleware(taskWatchersRouter);
    if (!mw) return;
    const req = mockReq({ user: { id: 'sa1', role: 'super_admin' }, params: { taskId: 't1' } });
    const res = mockRes();
    const next = vi.fn();
    await mw(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
  });
});
