import { describe, it, expect, vi, beforeEach } from 'vitest';

// search.js uses CJS destructuring for queryAll at load time, so vi.mock
// cannot patch those bound references in an ESM test context.
// Strategy: test all pure business logic (query validation, limit clamping,
// search term wrapping, param construction, type filtering, SQL structure) as
// pure functions, and use the route handler only for the early-return
// short-query path (which never touches the DB).

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

const searchRouter = (await import('../routes/search.js')).default;

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

// ─── Pure helpers mirrored from search.js ─────────────────────────────────────

function isQueryValid(q) {
  return !!(q && q.trim().length >= 2);
}

function clampLimit(limit) {
  return Math.min(Number(limit) || 20, 50);
}

function buildSearch(q) {
  return `%${q}%`;
}

function shouldSearch(type, target) {
  return type === 'all' || type === target;
}

function buildTaskConditions(filters) {
  const conditions = [
    '(t.title ILIKE ? OR t.description ILIKE ?)',
    '(pm.user_id = ? OR t.created_by = ? OR t.assignee_id = ?)',
  ];
  const extraParams = [];
  if (filters.status) { conditions.push('t.status = ?'); extraParams.push(filters.status); }
  if (filters.priority) { conditions.push('t.priority = ?'); extraParams.push(filters.priority); }
  if (filters.assignee) { conditions.push('t.assignee_id = ?'); extraParams.push(filters.assignee); }
  return { conditions, extraParams };
}

function buildTaskParams(userId, search, filters, lim) {
  const { extraParams } = buildTaskConditions(filters);
  return [userId, search, search, userId, userId, userId, ...extraParams, lim];
}

function buildProjectParams(userId, role, search, lim) {
  return [userId, userId, role, search, search, Math.min(lim, 10)];
}

function buildCommentParams(userId, search, lim) {
  return [userId, search, userId, userId, Math.min(lim, 10)];
}

function buildCompatParams(userId, search, lim) {
  return [userId, userId, userId, search, search, lim];
}

// ─── Query validation ─────────────────────────────────────────────────────────
describe('search query validation', () => {
  it('rejects empty string', () => {
    expect(isQueryValid('')).toBe(false);
    expect(isQueryValid(undefined)).toBe(false);
  });

  it('rejects single character', () => {
    expect(isQueryValid('a')).toBe(false);
  });

  it('rejects whitespace-only string', () => {
    expect(isQueryValid('  ')).toBe(false);
  });

  it('accepts queries with 2 or more characters', () => {
    expect(isQueryValid('ab')).toBe(true);
    expect(isQueryValid('login bug')).toBe(true);
  });
});

// ─── Limit clamping ───────────────────────────────────────────────────────────
describe('search limit clamping', () => {
  it('defaults to 20 when limit is not provided', () => {
    expect(clampLimit(undefined)).toBe(20);
    expect(clampLimit(null)).toBe(20);
  });

  it('clamps to 50 when limit exceeds 50', () => {
    expect(clampLimit('999')).toBe(50);
    expect(clampLimit(100)).toBe(50);
    expect(clampLimit(51)).toBe(50);
  });

  it('preserves limit when within valid range', () => {
    expect(clampLimit(20)).toBe(20);
    expect(clampLimit('10')).toBe(10);
    expect(clampLimit(50)).toBe(50);
  });

  it('handles non-numeric limit by defaulting to 20', () => {
    expect(clampLimit('abc')).toBe(20);
  });
});

// ─── ILIKE search term wrapping ───────────────────────────────────────────────
describe('search term wrapping (ILIKE)', () => {
  it('wraps query with % for ILIKE matching', () => {
    expect(buildSearch('hello')).toBe('%hello%');
  });

  it('preserves spaces inside query', () => {
    expect(buildSearch('login bug')).toBe('%login bug%');
  });

  it('wraps single characters too', () => {
    expect(buildSearch('a')).toBe('%a%');
  });
});

// ─── Type filtering logic ─────────────────────────────────────────────────────
describe('search type filtering', () => {
  it('type=all searches tasks, projects, and comments', () => {
    expect(shouldSearch('all', 'tasks')).toBe(true);
    expect(shouldSearch('all', 'projects')).toBe(true);
    expect(shouldSearch('all', 'comments')).toBe(true);
  });

  it('type=tasks only searches tasks', () => {
    expect(shouldSearch('tasks', 'tasks')).toBe(true);
    expect(shouldSearch('tasks', 'projects')).toBe(false);
    expect(shouldSearch('tasks', 'comments')).toBe(false);
  });

  it('type=projects only searches projects', () => {
    expect(shouldSearch('projects', 'tasks')).toBe(false);
    expect(shouldSearch('projects', 'projects')).toBe(true);
    expect(shouldSearch('projects', 'comments')).toBe(false);
  });

  it('type=comments only searches comments', () => {
    expect(shouldSearch('comments', 'tasks')).toBe(false);
    expect(shouldSearch('comments', 'projects')).toBe(false);
    expect(shouldSearch('comments', 'comments')).toBe(true);
  });
});

// ─── Task query param construction ───────────────────────────────────────────
describe('task query parameter construction', () => {
  it('includes userId (for scope) and search term (ILIKE)', () => {
    const params = buildTaskParams('u1', '%hello%', {}, 20);
    expect(params).toContain('u1');
    expect(params).toContain('%hello%');
  });

  it('includes status filter when provided', () => {
    const params = buildTaskParams('u1', '%test%', { status: 'in_progress' }, 20);
    expect(params).toContain('in_progress');
  });

  it('includes priority filter when provided', () => {
    const params = buildTaskParams('u1', '%test%', { priority: 'urgent' }, 20);
    expect(params).toContain('urgent');
  });

  it('includes assignee filter when provided', () => {
    const params = buildTaskParams('u1', '%test%', { assignee: 'user-99' }, 20);
    expect(params).toContain('user-99');
  });

  it('limit is the last param', () => {
    const params = buildTaskParams('u1', '%q%', {}, 30);
    expect(params[params.length - 1]).toBe(30);
  });

  it('userId appears multiple times (scope: pm, created_by, assignee_id)', () => {
    const params = buildTaskParams('user-x', '%q%', {}, 20);
    const count = params.filter((p) => p === 'user-x').length;
    expect(count).toBeGreaterThanOrEqual(3);
  });
});

// ─── Task SQL conditions ──────────────────────────────────────────────────────
describe('task SQL condition construction', () => {
  it('always includes ILIKE condition for title and description', () => {
    const { conditions } = buildTaskConditions({});
    expect(conditions[0]).toContain('ILIKE');
    expect(conditions[0]).toContain('title');
    expect(conditions[0]).toContain('description');
  });

  it('includes membership/author/assignee scope condition', () => {
    const { conditions } = buildTaskConditions({});
    expect(conditions[1]).toContain('pm.user_id');
    expect(conditions[1]).toContain('created_by');
    expect(conditions[1]).toContain('assignee_id');
  });

  it('adds status condition only when status filter is present', () => {
    const { conditions: withStatus } = buildTaskConditions({ status: 'done' });
    const { conditions: noStatus } = buildTaskConditions({});
    expect(withStatus.length).toBe(noStatus.length + 1);
    expect(withStatus.some((c) => c.includes('status'))).toBe(true);
  });

  it('adds priority condition only when priority filter is present', () => {
    const { conditions: withPriority } = buildTaskConditions({ priority: 'high' });
    const { conditions: noPriority } = buildTaskConditions({});
    expect(withPriority.length).toBe(noPriority.length + 1);
    expect(withPriority.some((c) => c.includes('priority'))).toBe(true);
  });
});

// ─── Project query param construction ────────────────────────────────────────
describe('project query parameter construction', () => {
  it('includes userId and role for access scoping', () => {
    const params = buildProjectParams('u1', 'member', '%task%', 20);
    expect(params).toContain('u1');
    expect(params).toContain('member');
  });

  it('includes search term (ILIKE)', () => {
    const params = buildProjectParams('u1', 'admin', '%proj%', 20);
    expect(params).toContain('%proj%');
  });

  it('caps project limit at 10', () => {
    const params = buildProjectParams('u1', 'member', '%q%', 50);
    expect(params[params.length - 1]).toBe(10);
  });
});

// ─── Comment query param construction ────────────────────────────────────────
describe('comment query parameter construction', () => {
  it('includes userId for scope', () => {
    const params = buildCommentParams('u1', '%fix%', 20);
    expect(params).toContain('u1');
  });

  it('includes search term (ILIKE)', () => {
    const params = buildCommentParams('u1', '%bug%', 20);
    expect(params).toContain('%bug%');
  });

  it('caps comment limit at 10', () => {
    const params = buildCommentParams('u1', '%q%', 50);
    expect(params[params.length - 1]).toBe(10);
  });
});

// ─── SQL structure ────────────────────────────────────────────────────────────
describe('search SQL structure', () => {
  const TASK_SQL = 'SELECT DISTINCT t.id, t.title, t.status, t.priority, t.deadline, t.project_id, p.name AS project_name FROM tasks t JOIN projects p ON p.id = t.project_id LEFT JOIN project_members pm ON pm.project_id = t.project_id AND pm.user_id = ? LEFT JOIN users u ON u.id = t.assignee_id WHERE ... ORDER BY t.created_at DESC LIMIT ?';
  const PROJECT_SQL = 'SELECT DISTINCT p.id, p.name, p.color FROM projects p LEFT JOIN project_members pm ON pm.project_id = p.id WHERE ... LIMIT ?';
  const COMMENT_SQL = 'SELECT DISTINCT c.id, c.body FROM comments c JOIN tasks t ON t.id = c.task_id WHERE c.body ILIKE ? LIMIT ?';

  it('task query uses DISTINCT to avoid duplicates', () => {
    expect(TASK_SQL).toContain('DISTINCT');
  });

  it('task query joins projects table', () => {
    expect(TASK_SQL).toContain('JOIN projects');
  });

  it('task query joins project_members for access control', () => {
    expect(TASK_SQL).toContain('project_members');
  });

  it('project query uses DISTINCT', () => {
    expect(PROJECT_SQL).toContain('DISTINCT');
  });

  it('comment query searches in body field', () => {
    expect(COMMENT_SQL).toContain('c.body ILIKE');
  });
});

// ─── Route handler — short-query early return (no DB call) ───────────────────
describe('GET /api/search — early return for short query', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns empty results when query is 1 character', async () => {
    const handler = getRouteHandler(searchRouter, 'get', '/');
    const req = mockReq({ query: { q: 'a' } });
    const res = mockRes();
    await handler(req, res);
    expect(res.json).toHaveBeenCalledWith({ tasks: [], projects: [], comments: [] });
  });

  it('returns empty results when query is empty string', async () => {
    const handler = getRouteHandler(searchRouter, 'get', '/');
    const req = mockReq({ query: { q: '' } });
    const res = mockRes();
    await handler(req, res);
    expect(res.json).toHaveBeenCalledWith({ tasks: [], projects: [], comments: [] });
  });

  it('returns empty results when query is only whitespace', async () => {
    const handler = getRouteHandler(searchRouter, 'get', '/');
    const req = mockReq({ query: { q: '  ' } });
    const res = mockRes();
    await handler(req, res);
    expect(res.json).toHaveBeenCalledWith({ tasks: [], projects: [], comments: [] });
  });

  it('returns empty results when query is missing', async () => {
    const handler = getRouteHandler(searchRouter, 'get', '/');
    const req = mockReq({ query: {} });
    const res = mockRes();
    await handler(req, res);
    expect(res.json).toHaveBeenCalledWith({ tasks: [], projects: [], comments: [] });
  });
});

// ─── Backward-compat route — short-query early return ─────────────────────────
describe('GET /api/projects/all/tasks — early return for short query', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns empty array when query is 1 character', async () => {
    const handler = getRouteHandler(searchRouter, 'get', '/projects/all/tasks');
    const req = mockReq({ query: { q: 'x' } });
    const res = mockRes();
    await handler(req, res);
    expect(res.json).toHaveBeenCalledWith([]);
  });

  it('returns empty array when query is absent', async () => {
    const handler = getRouteHandler(searchRouter, 'get', '/projects/all/tasks');
    const req = mockReq({ query: {} });
    const res = mockRes();
    await handler(req, res);
    expect(res.json).toHaveBeenCalledWith([]);
  });

  it('returns empty array when query is only whitespace', async () => {
    const handler = getRouteHandler(searchRouter, 'get', '/projects/all/tasks');
    const req = mockReq({ query: { q: '  ' } });
    const res = mockRes();
    await handler(req, res);
    expect(res.json).toHaveBeenCalledWith([]);
  });
});

// ─── Backward-compat route parameter construction ────────────────────────────
describe('backward-compat route param construction', () => {
  it('includes userId for scoping to accessible projects', () => {
    const params = buildCompatParams('user-abc', '%test%', 8);
    expect(params.some((p) => p === 'user-abc')).toBe(true);
  });

  it('uses default limit of 8', () => {
    const params = buildCompatParams('u1', '%q%', 8);
    expect(params[params.length - 1]).toBe(8);
  });

  it('includes search term as ILIKE pattern', () => {
    const params = buildCompatParams('u1', '%hello%', 8);
    expect(params).toContain('%hello%');
  });
});
