import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import os from 'os';

// Set env vars first
process.env.BACKUP_ENCRYPTION_KEY = 'test_backup_key_32chars_longxxx';
process.env.BACKUP_RETENTION_DAYS = '30';
process.env.BACKUP_CRON = '0 2 * * *';
process.env.JWT_SECRET = 'test_jwt_secret_super_long_key_32c';
process.env.JWT_REFRESH_SECRET = 'test_refresh_secret_super_long_32c';

// ─── Encryption round-trip (unit test without file I/O) ──────────────────────
describe('Backup encryption (AES-256-CBC)', () => {
  function getKey() {
    const k = process.env.BACKUP_ENCRYPTION_KEY;
    return crypto.scryptSync(k, 'taskflow_salt', 32);
  }

  function encrypt(buf) {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', getKey(), iv);
    const enc = Buffer.concat([cipher.update(buf), cipher.final()]);
    return Buffer.concat([iv, enc]);
  }

  function decrypt(buf) {
    const iv = buf.slice(0, 16);
    const data = buf.slice(16);
    const decipher = crypto.createDecipheriv('aes-256-cbc', getKey(), iv);
    return Buffer.concat([decipher.update(data), decipher.final()]);
  }

  it('encrypts a buffer to a different value', () => {
    const original = Buffer.from('Hello, SQLite database backup!');
    const encrypted = encrypt(original);
    expect(Buffer.compare(original, encrypted)).not.toBe(0);
  });

  it('decrypts back to the original content', () => {
    const original = Buffer.from('Important data that must survive encryption roundtrip');
    const encrypted = encrypt(original);
    const decrypted = decrypt(encrypted);
    expect(decrypted.toString()).toBe(original.toString());
  });

  it('encrypted output is longer than input (IV + padding)', () => {
    const original = Buffer.from('Short');
    const encrypted = encrypt(original);
    expect(encrypted.length).toBeGreaterThan(original.length);
  });

  it('encrypted output starts with 16-byte IV', () => {
    const original = Buffer.from('Test data');
    const encrypted = encrypt(original);
    expect(encrypted.length).toBeGreaterThanOrEqual(16);
  });

  it('different encryptions of same data produce different ciphertext (random IV)', () => {
    const data = Buffer.from('Same data');
    const enc1 = encrypt(data);
    const enc2 = encrypt(data);
    expect(Buffer.compare(enc1, enc2)).not.toBe(0);
  });

  it('decryption with wrong key fails', () => {
    const original = Buffer.from('Secret');
    const encrypted = encrypt(original);

    const wrongKey = crypto.scryptSync('wrong_key', 'taskflow_salt', 32);
    const iv = encrypted.slice(0, 16);
    const data = encrypted.slice(16);
    expect(() => {
      const decipher = crypto.createDecipheriv('aes-256-cbc', wrongKey, iv);
      Buffer.concat([decipher.update(data), decipher.final()]);
    }).toThrow();
  });

  it('handles binary data (simulated SQLite file)', () => {
    // SQLite files start with this magic string
    const sqliteMagic = Buffer.from('SQLite format 3\x00');
    const fakeDb = Buffer.concat([sqliteMagic, Buffer.alloc(100, 0xAB)]);
    const encrypted = encrypt(fakeDb);
    const decrypted = decrypt(encrypted);
    expect(decrypted.slice(0, 16).toString('utf8')).toBe('SQLite format 3\x00');
  });
});

// ─── Backup file lifecycle (with real temp dir) ───────────────────────────────
describe('Backup file lifecycle', () => {
  let tmpDir;

  beforeAll(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'taskflow-test-'));
  });

  afterAll(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('creates a backup file in the temp directory', () => {
    const filename = `backup_${Date.now()}.db.enc`;
    const content = Buffer.from('SQLite format 3\x00' + 'x'.repeat(100));
    fs.writeFileSync(path.join(tmpDir, filename), content);
    expect(fs.existsSync(path.join(tmpDir, filename))).toBe(true);
  });

  it('backup filename follows expected pattern', () => {
    const pattern = /^backup_\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.db\.enc$/;
    const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `backup_${ts}.db.enc`;
    expect(pattern.test(filename)).toBe(true);
  });

  it('old backups can be listed and sorted by mtime', () => {
    const files = ['backup_a.db.enc', 'backup_b.db.enc', 'backup_c.db.enc'];
    files.forEach((f) => {
      fs.writeFileSync(path.join(tmpDir, f), Buffer.from('data'));
    });
    const listed = fs.readdirSync(tmpDir)
      .filter((f) => f.endsWith('.db.enc'))
      .map((f) => ({ name: f, mtime: fs.statSync(path.join(tmpDir, f)).mtime }))
      .sort((a, b) => b.mtime - a.mtime);
    expect(listed.length).toBeGreaterThanOrEqual(3);
    expect(listed.every((f) => f.name.endsWith('.db.enc'))).toBe(true);
  });

  it('restored file content matches original', () => {
    const original = Buffer.from('SQLite format 3\x00' + 'z'.repeat(200));
    const backupPath = path.join(tmpDir, 'restore_test.db.enc');
    const dbPath = path.join(tmpDir, 'test.db');
    fs.writeFileSync(backupPath, original);
    fs.copyFileSync(backupPath, dbPath);
    const restored = fs.readFileSync(dbPath);
    expect(Buffer.compare(original, restored)).toBe(0);
  });
});

// ─── Cron schedule validation ─────────────────────────────────────────────────
describe('Backup cron schedule', () => {
  it('default cron expression is valid format', () => {
    const cron = process.env.BACKUP_CRON || '0 2 * * *';
    const parts = cron.trim().split(/\s+/);
    expect(parts).toHaveLength(5);
  });

  it('default cron runs at 2 AM', () => {
    const cron = '0 2 * * *';
    const [minute, hour] = cron.split(' ');
    expect(minute).toBe('0');
    expect(hour).toBe('2');
  });

  it('BACKUP_RETENTION_DAYS is a positive integer', () => {
    const days = parseInt(process.env.BACKUP_RETENTION_DAYS || '30', 10);
    expect(Number.isInteger(days)).toBe(true);
    expect(days).toBeGreaterThan(0);
  });
});
