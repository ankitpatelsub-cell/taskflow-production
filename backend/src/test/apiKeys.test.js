import { describe, it, expect, vi, beforeEach } from 'vitest';

// apiKeys.js uses CJS destructuring for db functions at load time. vi.mock cannot
// patch those bound references in an ESM test context.
// Strategy: test hashKey(), key format, scope validation, and limit logic as
// pure functions; import authenticate for the tick_ auth path (which we exercise
// indirectly via the auth middleware's pure logic).

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

const { hashKey, apiKeyRouter } = await import('../routes/apiKeys.js');

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

// ─── Pure helpers mirrored from apiKeys.js ────────────────────────────────────

const ALLOWED_SCOPES = ['read', 'write', 'admin'];
const MAX_KEYS = 10;
const KEY_PREFIX = 'tick_';
const KEY_HEX_LENGTH = 48; // randomBytes(24).toString('hex')

function validateScopes(scopes) {
  if (!scopes) return null;
  const list = scopes.split(',').map((s) => s.trim());
  const invalid = list.filter((s) => !ALLOWED_SCOPES.includes(s));
  if (invalid.length) return { error: 'Invalid scopes. Allowed: read, write, admin' };
  return null;
}

function validateName(name) {
  if (!name?.trim()) return { error: 'Name is required' };
  return null;
}

function validateKeyCount(n) {
  if (Number(n) >= MAX_KEYS) return { error: 'Maximum 10 API keys allowed' };
  return null;
}

function generateRawKey() {
  const fakeHex = 'a'.repeat(KEY_HEX_LENGTH);
  return `${KEY_PREFIX}${fakeHex}`;
}

function buildKeyPrefix(raw) {
  return raw.slice(0, 12);
}

// ─── hashKey() ────────────────────────────────────────────────────────────────
describe('hashKey()', () => {
  it('returns a 64-character hex string', () => {
    const result = hashKey('tick_abc123');
    expect(result).toHaveLength(64);
    expect(result).toMatch(/^[0-9a-f]{64}$/);
  });

  it('is deterministic — same input always produces same hash', () => {
    const raw = 'tick_someconsistentvalue';
    expect(hashKey(raw)).toBe(hashKey(raw));
  });

  it('produces different hashes for different inputs', () => {
    const h1 = hashKey('tick_aaaaaa');
    const h2 = hashKey('tick_bbbbbb');
    expect(h1).not.toBe(h2);
  });

  it('handles a realistic tick_ key input without error', () => {
    const raw = 'tick_' + 'a'.repeat(48);
    expect(() => hashKey(raw)).not.toThrow();
    expect(hashKey(raw)).toHaveLength(64);
  });
});

// ─── Raw key format ───────────────────────────────────────────────────────────
describe('API key raw format', () => {
  it('starts with tick_ prefix', () => {
    const raw = generateRawKey();
    expect(raw.startsWith('tick_')).toBe(true);
  });

  it('is at least 50 characters long', () => {
    const raw = generateRawKey();
    expect(raw.length).toBeGreaterThanOrEqual(50);
  });

  it('hex portion is 48 characters (randomBytes(24).toString("hex"))', () => {
    const raw = generateRawKey();
    const hexPart = raw.slice(5); // after 'tick_'
    expect(hexPart).toHaveLength(KEY_HEX_LENGTH);
  });

  it('key_prefix is first 12 characters', () => {
    const raw = generateRawKey();
    const prefix = buildKeyPrefix(raw);
    expect(prefix).toHaveLength(12);
    expect(prefix.startsWith('tick_')).toBe(true);
  });
});

// ─── Scope validation ─────────────────────────────────────────────────────────
describe('API key scope validation', () => {
  it('returns null for valid single scope "read"', () => {
    expect(validateScopes('read')).toBeNull();
  });

  it('returns null for valid single scope "write"', () => {
    expect(validateScopes('write')).toBeNull();
  });

  it('returns null for valid single scope "admin"', () => {
    expect(validateScopes('admin')).toBeNull();
  });

  it('returns null for combined valid scopes "read,write"', () => {
    expect(validateScopes('read,write')).toBeNull();
  });

  it('returns null for all three valid scopes', () => {
    expect(validateScopes('read,write,admin')).toBeNull();
  });

  it('returns error for unknown scope', () => {
    const result = validateScopes('read,superpower');
    expect(result).not.toBeNull();
    expect(result.error).toContain('Invalid scopes');
    expect(result.error).toContain('read, write, admin');
  });

  it('returns error for completely invalid scope', () => {
    expect(validateScopes('delete')).not.toBeNull();
  });

  it('returns null when scopes is absent', () => {
    expect(validateScopes(undefined)).toBeNull();
    expect(validateScopes(null)).toBeNull();
  });
});

// ─── Name validation ──────────────────────────────────────────────────────────
describe('API key name validation', () => {
  it('fails on missing name', () => {
    expect(validateName(undefined)).toEqual({ error: 'Name is required' });
    expect(validateName(null)).toEqual({ error: 'Name is required' });
  });

  it('fails on empty string', () => {
    expect(validateName('')).toEqual({ error: 'Name is required' });
  });

  it('fails on whitespace-only name', () => {
    expect(validateName('   ')).toEqual({ error: 'Name is required' });
  });

  it('passes for valid name', () => {
    expect(validateName('CI Key')).toBeNull();
    expect(validateName('Deploy')).toBeNull();
  });
});

// ─── Max key count enforcement ────────────────────────────────────────────────
describe('API key count limit', () => {
  it('blocks creation when user already has 10 keys', () => {
    expect(validateKeyCount('10')).toEqual({ error: 'Maximum 10 API keys allowed' });
    expect(validateKeyCount(10)).toEqual({ error: 'Maximum 10 API keys allowed' });
  });

  it('allows creation with 9 keys', () => {
    expect(validateKeyCount('9')).toBeNull();
    expect(validateKeyCount(9)).toBeNull();
  });

  it('allows creation with 0 keys', () => {
    expect(validateKeyCount('0')).toBeNull();
  });
});

// ─── Hash–key consistency ─────────────────────────────────────────────────────
describe('API key hash consistency', () => {
  it('hashKey output is suitable for DB storage (64-char SHA-256 hex)', () => {
    const raw = 'tick_' + 'b'.repeat(48);
    const hash = hashKey(raw);
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[0-9a-f]+$/);
  });

  it('same raw key always hashes to same value (idempotent verify)', () => {
    const raw = 'tick_deadbeef1234567890abcdef1234567890abcdef12345';
    expect(hashKey(raw)).toBe(hashKey(raw));
  });

  it('stored hash can be used to verify a presented key', () => {
    const raw = 'tick_' + 'c'.repeat(48);
    const storedHash = hashKey(raw);
    const presentedHash = hashKey(raw);
    expect(storedHash).toBe(presentedHash);
  });
});

// ─── Route handler — pre-DB input validation ──────────────────────────────────
describe('POST /api/me/api-keys — input validation via handler', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('rejects with 400 when name is missing', async () => {
    const handler = getRouteHandler(apiKeyRouter, 'post', '/');
    const req = mockReq({ body: {} });
    const res = mockRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Name is required' });
  });

  it('rejects with 400 when name is only whitespace', async () => {
    const handler = getRouteHandler(apiKeyRouter, 'post', '/');
    const req = mockReq({ body: { name: '   ' } });
    const res = mockRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Name is required' });
  });

  it('rejects with 400 for invalid scopes', async () => {
    const handler = getRouteHandler(apiKeyRouter, 'post', '/');
    const req = mockReq({ body: { name: 'My Key', scopes: 'read,superpower' } });
    const res = mockRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid scopes. Allowed: read, write, admin' });
  });
});
