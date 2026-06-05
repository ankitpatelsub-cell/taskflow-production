const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { getPool, queryAll, execute } = require('../config/db');
const { BACKUP_ENCRYPTION_KEY, BACKUP_RETENTION_DAYS } = require('../config/env');
const { v4: uuidv4 } = require('uuid');
const logger = require('../config/logger');

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

// Tables to back up, in dependency order
const TABLES = [
  'users', 'refresh_tokens', 'projects', 'project_members',
  'tasks', 'tags', 'task_tags', 'comments', 'attachments',
  'activity_log', 'notifications', 'backups', 'subscriptions', 'invite_tokens',
];

async function createBackup(userId = null, notes = 'Scheduled backup') {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const filename = `backup_${timestamp}.json.enc`;
  const destPath = path.join(BACKUP_DIR, filename);

  logger.info({ filename, triggeredBy: userId || 'cron' }, 'backup.starting');

  const dump = {};
  for (const table of TABLES) {
    try {
      dump[table] = await queryAll(`SELECT * FROM ${table}`);
    } catch {
      dump[table] = [];
    }
  }

  const jsonBuf = Buffer.from(JSON.stringify({ version: 2, tables: dump, created_at: new Date().toISOString() }), 'utf8');
  const encrypted = encryptBuffer(jsonBuf);
  fs.writeFileSync(destPath, encrypted);

  const size = fs.statSync(destPath).size;
  await execute(
    'INSERT INTO backups (id, filename, size_bytes, created_by, notes) VALUES (?, ?, ?, ?, ?)',
    [uuidv4(), filename, size, userId, notes]
  );

  await cleanOldBackups();
  logger.info({ filename, sizeKb: (size / 1024).toFixed(1) }, 'backup.created');
  return { filename, size };
}

async function cleanOldBackups() {
  const files = fs.readdirSync(BACKUP_DIR)
    .filter((f) => f.endsWith('.json.enc') || f.endsWith('.db.enc'))
    .map((f) => ({ name: f, mtime: fs.statSync(path.join(BACKUP_DIR, f)).mtime }))
    .sort((a, b) => b.mtime - a.mtime);

  const toRemove = files.slice(BACKUP_RETENTION_DAYS);
  for (const f of toRemove) {
    fs.unlinkSync(path.join(BACKUP_DIR, f.name));
    logger.info({ filename: f.name }, 'backup.pruned');
  }
}

async function restoreBackup(encryptedFilePath) {
  logger.warn({ file: encryptedFilePath }, 'backup.restore_started');

  const encrypted = fs.readFileSync(encryptedFilePath);
  const decrypted = decryptBuffer(encrypted);
  const data = JSON.parse(decrypted.toString('utf8'));

  if (!data.tables || data.version !== 2) {
    throw new Error('Invalid backup format');
  }

  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    for (const table of [...TABLES].reverse()) {
      try {
        await client.query(`DELETE FROM ${table}`);
      } catch { /* table may not exist */ }
    }

    let rowsRestored = 0;
    for (const table of TABLES) {
      const rows = data.tables[table] || [];
      for (const row of rows) {
        const cols = Object.keys(row);
        const vals = Object.values(row);
        const placeholders = cols.map((_, i) => `$${i + 1}`).join(', ');
        await client.query(
          `INSERT INTO ${table} (${cols.join(', ')}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`,
          vals
        );
        rowsRestored++;
      }
    }

    await client.query('COMMIT');
    logger.warn({ file: encryptedFilePath, rowsRestored }, 'backup.restore_complete');
  } catch (err) {
    await client.query('ROLLBACK');
    logger.error({ file: encryptedFilePath, err: err.message }, 'backup.restore_failed');
    throw err;
  } finally {
    client.release();
  }
}

async function listBackups() {
  return queryAll(`
    SELECT b.*, u.name as created_by_name
    FROM backups b LEFT JOIN users u ON u.id = b.created_by
    ORDER BY b.created_at DESC
  `);
}

module.exports = { createBackup, restoreBackup, listBackups };
