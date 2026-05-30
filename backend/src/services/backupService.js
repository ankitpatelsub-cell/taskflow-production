const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { getDb, closeDb, DB_PATH } = require('../config/db');
const { BACKUP_ENCRYPTION_KEY, BACKUP_RETENTION_DAYS } = require('../config/env');
const { v4: uuidv4 } = require('uuid');

const BACKUP_DIR = path.join(__dirname, '../../data/backups');

if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

function getKey() {
  const key = BACKUP_ENCRYPTION_KEY || 'fallback_key_change_in_production';
  return crypto.scryptSync(key, 'taskflow_salt', 32);
}

function encryptBuffer(buf) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(buf), cipher.final()]);
  return Buffer.concat([iv, encrypted]);
}

function decryptBuffer(buf) {
  const iv = buf.slice(0, 16);
  const data = buf.slice(16);
  const decipher = crypto.createDecipheriv('aes-256-cbc', getKey(), iv);
  return Buffer.concat([decipher.update(data), decipher.final()]);
}

async function createBackup(userId = null, notes = 'Scheduled backup') {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const filename = `backup_${timestamp}.db.enc`;
  const destPath = path.join(BACKUP_DIR, filename);

  if (!fs.existsSync(DB_PATH)) throw new Error('Database file not found');

  const dbBuf = fs.readFileSync(DB_PATH);
  const encrypted = encryptBuffer(dbBuf);
  fs.writeFileSync(destPath, encrypted);

  const size = fs.statSync(destPath).size;
  const db = getDb();
  db.prepare('INSERT INTO backups (id, filename, size_bytes, created_by, notes) VALUES (?, ?, ?, ?, ?)')
    .run(uuidv4(), filename, size, userId, notes);

  cleanOldBackups(db);
  console.log(`[Backup] Created: ${filename} (${(size / 1024).toFixed(1)} KB)`);
  return { filename, size };
}

function cleanOldBackups(db) {
  const files = fs.readdirSync(BACKUP_DIR)
    .filter(f => f.endsWith('.db.enc'))
    .map(f => ({ name: f, mtime: fs.statSync(path.join(BACKUP_DIR, f)).mtime }))
    .sort((a, b) => b.mtime - a.mtime);

  const retain = BACKUP_RETENTION_DAYS;
  files.slice(retain).forEach(f => {
    fs.unlinkSync(path.join(BACKUP_DIR, f.name));
    db.prepare('DELETE FROM backups WHERE filename = ?').run(f.name);
    console.log(`[Backup] Removed old backup: ${f.name}`);
  });
}

async function restoreBackup(encryptedFilePath) {
  const encrypted = fs.readFileSync(encryptedFilePath);
  const decrypted = decryptBuffer(encrypted);

  // Validate it's a SQLite database
  const magic = decrypted.slice(0, 16).toString('utf8');
  if (!magic.startsWith('SQLite format 3')) {
    throw new Error('Invalid backup file: not a valid SQLite database');
  }

  const tempPath = DB_PATH + '.restore_tmp';
  fs.writeFileSync(tempPath, decrypted);
  fs.renameSync(tempPath, DB_PATH);
  console.log('[Backup] Database restored successfully');
}

function listBackups() {
  const db = getDb();
  return db.prepare(`
    SELECT b.*, u.name as created_by_name
    FROM backups b LEFT JOIN users u ON u.id = b.created_by
    ORDER BY b.created_at DESC
  `).all();
}

module.exports = { createBackup, restoreBackup, listBackups };
