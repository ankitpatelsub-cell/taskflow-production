import { describe, it, expect } from 'vitest';
import { hash, compare } from '../utils/password.js';
import { signAccess, verifyAccess, signRefresh, verifyRefresh } from '../utils/jwt.js';
import jwt from 'jsonwebtoken';

process.env.JWT_SECRET = 'test_jwt_secret_32chars_long_key';
process.env.JWT_REFRESH_SECRET = 'test_refresh_secret_32chars_long';
process.env.BACKUP_ENCRYPTION_KEY = 'test_backup_key_32chars_longxxx';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';

// ─── Password utilities ───────────────────────────────────────────────────────
describe('Password utilities', () => {
  it('hash() produces a string different from the input', async () => {
    const plain = 'myPassword123';
    const hashed = await hash(plain);
    expect(typeof hashed).toBe('string');
    expect(hashed).not.toBe(plain);
  });

  it('hash() produces a bcrypt hash (starts with $2b$)', async () => {
    const hashed = await hash('testpass');
    expect(hashed).toMatch(/^\$2[ab]\$/);
  });

  it('compare() returns true for correct password', async () => {
    const hashed = await hash('correct');
    expect(await compare('correct', hashed)).toBe(true);
  });

  it('compare() returns false for wrong password', async () => {
    const hashed = await hash('correct');
    expect(await compare('wrong', hashed)).toBe(false);
  });

  it('hash() generates different hashes for same input (salted)', async () => {
    const h1 = await hash('same');
    const h2 = await hash('same');
    expect(h1).not.toBe(h2);
  });
});

// ─── JWT utilities ────────────────────────────────────────────────────────────
describe('JWT utilities', () => {
  const payload = { id: 'user-123', email: 'test@test.com', role: 'member', name: 'Test User' };

  it('signAccess() returns a valid JWT string', () => {
    const token = signAccess(payload);
    expect(typeof token).toBe('string');
    expect(token.length).toBeGreaterThan(20);
    expect(token.split('.')).toHaveLength(3);
  });

  it('verifyAccess() returns original payload', () => {
    const token = signAccess(payload);
    const decoded = verifyAccess(token);
    expect(decoded.id).toBe(payload.id);
    expect(decoded.email).toBe(payload.email);
    expect(decoded.role).toBe(payload.role);
  });

  it('verifyAccess() throws for tampered token', () => {
    const token = signAccess(payload);
    const tampered = token.slice(0, -5) + 'XXXXX';
    expect(() => verifyAccess(tampered)).toThrow();
  });

  it('verifyAccess() throws for token signed with wrong secret', () => {
    const badToken = jwt.sign(payload, 'wrong_secret_key', { expiresIn: '15m' });
    expect(() => verifyAccess(badToken)).toThrow();
  });

  it('signRefresh() creates a token verifiable by verifyRefresh()', () => {
    const token = signRefresh({ id: 'user-123' });
    const decoded = verifyRefresh(token);
    expect(decoded.id).toBe('user-123');
  });

  it('access token expires sooner than refresh token', () => {
    const accessToken = signAccess(payload);
    const refreshToken = signRefresh({ id: payload.id });
    const accessDecoded = jwt.decode(accessToken);
    const refreshDecoded = jwt.decode(refreshToken);
    expect(refreshDecoded.exp).toBeGreaterThan(accessDecoded.exp);
  });
});

// ─── Role hierarchy logic ─────────────────────────────────────────────────────
describe('Role weights', () => {
  const ROLE_WEIGHTS = {
    super_admin: 5, admin: 4, project_manager: 3, member: 2, viewer: 1,
  };
  const hasMinRole = (userRole, minRole) =>
    (ROLE_WEIGHTS[userRole] || 0) >= (ROLE_WEIGHTS[minRole] || 999);

  it('super_admin passes all role checks', () => {
    expect(hasMinRole('super_admin', 'viewer')).toBe(true);
    expect(hasMinRole('super_admin', 'admin')).toBe(true);
    expect(hasMinRole('super_admin', 'super_admin')).toBe(true);
  });

  it('viewer fails member and above checks', () => {
    expect(hasMinRole('viewer', 'member')).toBe(false);
    expect(hasMinRole('viewer', 'admin')).toBe(false);
  });

  it('member passes viewer check, fails admin check', () => {
    expect(hasMinRole('member', 'viewer')).toBe(true);
    expect(hasMinRole('member', 'admin')).toBe(false);
  });

  it('unknown role fails all checks', () => {
    expect(hasMinRole('unknown', 'viewer')).toBe(false);
  });
});
