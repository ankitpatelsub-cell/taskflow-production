import { describe, it, expect, vi, beforeEach } from 'vitest';

// Set env vars before any imports
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
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  info: vi.fn(), warn: vi.fn(), error: vi.fn(),
}));

// Import after mocks are set up
const { hasMinRole, ROLE_WEIGHTS, authenticate, requireRole, requireMinRole, requireWriteAccess } =
  await import('../middleware/auth.js');
const { signAccess } = await import('../utils/jwt.js');

// ─── Helpers ──────────────────────────────────────────────────────────────────
function mockRes() {
  const res = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

function mockReq(overrides = {}) {
  return { headers: {}, params: {}, user: null, method: 'GET', url: '/test', ip: '127.0.0.1', ...overrides };
}

// ─── hasMinRole ───────────────────────────────────────────────────────────────
describe('hasMinRole()', () => {
  it('super_admin passes all role checks', () => {
    expect(hasMinRole('super_admin', 'viewer')).toBe(true);
    expect(hasMinRole('super_admin', 'member')).toBe(true);
    expect(hasMinRole('super_admin', 'admin')).toBe(true);
    expect(hasMinRole('super_admin', 'super_admin')).toBe(true);
  });

  it('admin passes admin and below, fails super_admin', () => {
    expect(hasMinRole('admin', 'viewer')).toBe(true);
    expect(hasMinRole('admin', 'admin')).toBe(true);
    expect(hasMinRole('admin', 'super_admin')).toBe(false);
  });

  it('project_manager passes project_manager and below, fails admin', () => {
    expect(hasMinRole('project_manager', 'viewer')).toBe(true);
    expect(hasMinRole('project_manager', 'project_manager')).toBe(true);
    expect(hasMinRole('project_manager', 'admin')).toBe(false);
  });

  it('member passes member and viewer, fails project_manager', () => {
    expect(hasMinRole('member', 'viewer')).toBe(true);
    expect(hasMinRole('member', 'member')).toBe(true);
    expect(hasMinRole('member', 'project_manager')).toBe(false);
  });

  it('viewer passes only viewer', () => {
    expect(hasMinRole('viewer', 'viewer')).toBe(true);
    expect(hasMinRole('viewer', 'member')).toBe(false);
  });

  it('unknown role fails all checks', () => {
    expect(hasMinRole('unknown', 'viewer')).toBe(false);
    expect(hasMinRole(null, 'viewer')).toBe(false);
    expect(hasMinRole(undefined, 'viewer')).toBe(false);
  });
});

// ─── ROLE_WEIGHTS ─────────────────────────────────────────────────────────────
describe('ROLE_WEIGHTS', () => {
  it('has all 5 roles', () => {
    const roles = ['super_admin', 'admin', 'project_manager', 'member', 'viewer'];
    roles.forEach((r) => expect(ROLE_WEIGHTS).toHaveProperty(r));
  });

  it('super_admin weight is highest', () => {
    const max = Math.max(...Object.values(ROLE_WEIGHTS));
    expect(ROLE_WEIGHTS.super_admin).toBe(max);
  });

  it('viewer weight is lowest', () => {
    const min = Math.min(...Object.values(ROLE_WEIGHTS));
    expect(ROLE_WEIGHTS.viewer).toBe(min);
  });

  it('all weights are distinct positive integers', () => {
    const vals = Object.values(ROLE_WEIGHTS);
    const unique = new Set(vals);
    expect(unique.size).toBe(vals.length);
    vals.forEach((v) => expect(v).toBeGreaterThan(0));
  });
});

// ─── authenticate middleware ───────────────────────────────────────────────────
describe('authenticate()', () => {
  it('returns 401 when Authorization header is missing', () => {
    const req = mockReq();
    const res = mockRes();
    const next = vi.fn();
    authenticate(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'No token provided' });
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 when header does not start with Bearer', () => {
    const req = mockReq({ headers: { authorization: 'Basic abc123' } });
    const res = mockRes();
    const next = vi.fn();
    authenticate(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 for a tampered/invalid token', () => {
    const req = mockReq({ headers: { authorization: 'Bearer invalid.token.here' } });
    const res = mockRes();
    const next = vi.fn();
    authenticate(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid or expired token' });
    expect(next).not.toHaveBeenCalled();
  });

  it('calls next() and sets req.user for a valid token', () => {
    const payload = { id: 'u1', email: 'test@example.com', role: 'admin', name: 'Admin' };
    const token = signAccess(payload);
    const req = mockReq({ headers: { authorization: `Bearer ${token}` } });
    const res = mockRes();
    const next = vi.fn();
    authenticate(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(req.user).toBeTruthy();
    expect(req.user.id).toBe('u1');
    expect(req.user.role).toBe('admin');
  });
});

// ─── requireRole middleware ────────────────────────────────────────────────────
describe('requireRole()', () => {
  it('calls next() when user meets the required role', () => {
    const req = mockReq({ user: { id: 'u1', role: 'admin' } });
    const res = mockRes();
    const next = vi.fn();
    requireRole('admin')(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('calls next() for higher role (super_admin satisfies admin)', () => {
    const req = mockReq({ user: { id: 'u1', role: 'super_admin' } });
    const res = mockRes();
    const next = vi.fn();
    requireRole('admin')(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('returns 403 when user role is below the required role', () => {
    const req = mockReq({ user: { id: 'u2', role: 'member', url: '/admin' } });
    const res = mockRes();
    const next = vi.fn();
    requireRole('admin')(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'Forbidden' });
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 403 for viewer trying to access member route', () => {
    const req = mockReq({ user: { id: 'u3', role: 'viewer' } });
    const res = mockRes();
    const next = vi.fn();
    requireRole('member')(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
  });
});

// ─── requireMinRole middleware ─────────────────────────────────────────────────
describe('requireMinRole()', () => {
  it('passes when user meets minimum role', () => {
    const req = mockReq({ user: { id: 'u1', role: 'project_manager' } });
    const res = mockRes();
    const next = vi.fn();
    requireMinRole('project_manager')(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('returns 403 with descriptive message for insufficient role', () => {
    const req = mockReq({ user: { id: 'u2', role: 'viewer' } });
    const res = mockRes();
    const next = vi.fn();
    requireMinRole('project_manager')(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    const jsonArg = res.json.mock.calls[0][0];
    expect(jsonArg.error).toContain('project_manager');
  });
});

// ─── requireWriteAccess middleware ─────────────────────────────────────────────
describe('requireWriteAccess()', () => {
  it('blocks viewer with 403', () => {
    const req = mockReq({ user: { id: 'v1', role: 'viewer' } });
    const res = mockRes();
    const next = vi.fn();
    requireWriteAccess(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'Viewers have read-only access' });
    expect(next).not.toHaveBeenCalled();
  });

  it('allows member through', () => {
    const req = mockReq({ user: { id: 'm1', role: 'member' } });
    const res = mockRes();
    const next = vi.fn();
    requireWriteAccess(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('allows admin through', () => {
    const req = mockReq({ user: { id: 'a1', role: 'admin' } });
    const res = mockRes();
    const next = vi.fn();
    requireWriteAccess(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('allows project_manager through', () => {
    const req = mockReq({ user: { id: 'pm1', role: 'project_manager' } });
    const res = mockRes();
    const next = vi.fn();
    requireWriteAccess(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
  });
});
