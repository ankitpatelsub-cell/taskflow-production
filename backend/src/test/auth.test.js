import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Database from 'better-sqlite3';
import { hash, compare } from '../utils/password.js';
import { signAccess, verifyAccess, signRefresh, verifyRefresh } from '../utils/jwt.js';
import jwt from 'jsonwebtoken';

// Set up env vars for tests
process.env.JWT_SECRET = 'test_jwt_secret_32chars_long_key';
process.env.JWT_REFRESH_SECRET = 'test_refresh_secret_32chars_long';
process.env.BACKUP_ENCRYPTION_KEY = 'test_backup_key_32chars_longxxx';

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
  const payload = { id: 'user-123', email: 'test@test.com', role: 'user', name: 'Test User' };

  it('signAccess() returns a non-empty string', () => {
    const token = signAccess(payload);
    expect(typeof token).toBe('string');
    expect(token.length).toBeGreaterThan(20);
    expect(token.split('.')).toHaveLength(3); // header.payload.signature
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
});

// ─── SQLite DB schema ─────────────────────────────────────────────────────────
describe('Database schema', () => {
  let db;

  beforeAll(() => {
    // Use an in-memory DB for schema tests
    db = new Database(':memory:');
    db.pragma('foreign_keys = ON');
    // Dynamically apply schema
    const { applySchema } = (() => {
      // Inline the schema creation to avoid file path issues in tests
      db.exec(`
        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          email TEXT NOT NULL UNIQUE,
          password_hash TEXT NOT NULL,
          role TEXT NOT NULL DEFAULT 'user' CHECK(role IN ('admin','user')),
          avatar_url TEXT,
          timezone TEXT DEFAULT 'UTC',
          is_active INTEGER NOT NULL DEFAULT 1,
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS projects (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          description TEXT,
          color TEXT DEFAULT '#6366f1',
          status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','archived')),
          created_by TEXT NOT NULL REFERENCES users(id),
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS project_members (
          id TEXT PRIMARY KEY,
          project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
          user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          joined_at TEXT NOT NULL DEFAULT (datetime('now')),
          UNIQUE(project_id, user_id)
        );
        CREATE TABLE IF NOT EXISTS tasks (
          id TEXT PRIMARY KEY,
          project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
          parent_task_id TEXT REFERENCES tasks(id) ON DELETE CASCADE,
          title TEXT NOT NULL,
          description TEXT,
          status TEXT NOT NULL DEFAULT 'todo' CHECK(status IN ('todo','in_progress','review','done')),
          priority TEXT NOT NULL DEFAULT 'medium' CHECK(priority IN ('low','medium','high','critical')),
          assignee_id TEXT REFERENCES users(id) ON DELETE SET NULL,
          created_by TEXT NOT NULL REFERENCES users(id),
          deadline TEXT,
          estimated_hours REAL,
          position INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS tags (
          id TEXT PRIMARY KEY,
          project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
          name TEXT NOT NULL,
          color TEXT DEFAULT '#64748b',
          UNIQUE(project_id, name)
        );
        CREATE TABLE IF NOT EXISTS comments (
          id TEXT PRIMARY KEY,
          task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
          user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          content TEXT NOT NULL,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS notifications (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          type TEXT NOT NULL,
          message TEXT NOT NULL,
          entity_type TEXT,
          entity_id TEXT,
          is_read INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS backups (
          id TEXT PRIMARY KEY,
          filename TEXT NOT NULL,
          size_bytes INTEGER NOT NULL,
          created_by TEXT REFERENCES users(id),
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          notes TEXT
        );
      `);
      return {};
    })();
  });

  afterAll(() => { db.close(); });

  it('users table exists and has correct columns', () => {
    const cols = db.prepare("PRAGMA table_info('users')").all().map((c) => c.name);
    expect(cols).toContain('id');
    expect(cols).toContain('email');
    expect(cols).toContain('password_hash');
    expect(cols).toContain('role');
    expect(cols).toContain('is_active');
  });

  it('inserts and retrieves a user', () => {
    db.prepare('INSERT INTO users (id, name, email, password_hash, role) VALUES (?, ?, ?, ?, ?)').run(
      'u1', 'Test User', 'test@example.com', '$2b$hash', 'user'
    );
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get('u1');
    expect(user.name).toBe('Test User');
    expect(user.role).toBe('user');
    expect(user.is_active).toBe(1);
  });

  it('enforces UNIQUE constraint on email', () => {
    expect(() =>
      db.prepare('INSERT INTO users (id, name, email, password_hash) VALUES (?, ?, ?, ?)').run(
        'u2', 'Duplicate', 'test@example.com', 'hash'
      )
    ).toThrow();
  });

  it('enforces role CHECK constraint', () => {
    expect(() =>
      db.prepare('INSERT INTO users (id, name, email, password_hash, role) VALUES (?, ?, ?, ?, ?)').run(
        'u3', 'Bad Role', 'other@example.com', 'hash', 'superadmin'
      )
    ).toThrow();
  });

  it('tasks table has status CHECK constraint', () => {
    db.prepare('INSERT INTO users (id, name, email, password_hash) VALUES (?, ?, ?, ?)').run('p-creator', 'Creator', 'creator@test.com', 'h');
    db.prepare('INSERT INTO projects (id, name, created_by) VALUES (?, ?, ?)').run('proj1', 'P1', 'p-creator');
    expect(() =>
      db.prepare('INSERT INTO tasks (id, project_id, title, created_by, status) VALUES (?, ?, ?, ?, ?)').run(
        't1', 'proj1', 'Bad task', 'p-creator', 'invalid_status'
      )
    ).toThrow();
  });

  it('tasks cascade delete when project is deleted', () => {
    db.prepare('INSERT INTO users (id, name, email, password_hash) VALUES (?, ?, ?, ?)').run('del-user', 'Del', 'del@test.com', 'h');
    db.prepare('INSERT INTO projects (id, name, created_by) VALUES (?, ?, ?)').run('del-proj', 'DelProj', 'del-user');
    db.prepare('INSERT INTO tasks (id, project_id, title, created_by) VALUES (?, ?, ?, ?)').run('del-task', 'del-proj', 'Task', 'del-user');
    db.prepare('DELETE FROM projects WHERE id = ?').run('del-proj');
    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get('del-task');
    expect(task).toBeUndefined();
  });

  it('notifications table exists with is_read column', () => {
    const cols = db.prepare("PRAGMA table_info('notifications')").all().map((c) => c.name);
    expect(cols).toContain('is_read');
    expect(cols).toContain('user_id');
    expect(cols).toContain('message');
  });

  it('backups table exists', () => {
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map((t) => t.name);
    expect(tables).toContain('backups');
  });

  it('tags enforce UNIQUE(project_id, name)', () => {
    db.prepare('INSERT INTO users (id, name, email, password_hash) VALUES (?, ?, ?, ?)').run('tag-user', 'TagU', 'tag@test.com', 'h');
    db.prepare('INSERT INTO projects (id, name, created_by) VALUES (?, ?, ?)').run('tag-proj', 'TagProj', 'tag-user');
    db.prepare('INSERT INTO tags (id, project_id, name) VALUES (?, ?, ?)').run('tag1', 'tag-proj', 'Bug');
    expect(() =>
      db.prepare('INSERT INTO tags (id, project_id, name) VALUES (?, ?, ?)').run('tag2', 'tag-proj', 'Bug')
    ).toThrow();
  });
});
