const { Pool } = require('pg');

let pool;

function getPool() {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
      ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false,
    });
    pool.on('error', (err) => {
      console.error('[PG] Unexpected client error:', err.message);
    });
  }
  return pool;
}

// Convert SQLite-style ? placeholders to PostgreSQL $1, $2, ...
// and normalize SQLite-specific functions
function normalizeSql(sql) {
  let n = 0;
  return sql
    .replace(/\?/g, () => `$${++n}`)
    .replace(/datetime\('now'\)/gi, 'NOW()')
    .replace(/datetime\('now',\s*[^)]+\)/gi, 'NOW()')
    .replace(/COALESCE\(NOW\(\)/gi, "COALESCE(NOW()");
}

async function query(sql, params = []) {
  const normalized = normalizeSql(sql);
  const res = await getPool().query(normalized, params);
  return res;
}

async function queryOne(sql, params = []) {
  const res = await query(sql, params);
  return res.rows[0];
}

async function queryAll(sql, params = []) {
  const res = await query(sql, params);
  return res.rows;
}

async function execute(sql, params = []) {
  return query(sql, params);
}

async function withTransaction(fn) {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const txQuery = (sql, params = []) => client.query(normalizeSql(sql), params);
    const result = await fn(txQuery);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// Schema is managed by numbered SQL files in src/migrations/.
// To add a new migration: create the next numbered .sql file there.
async function initSchema() {
  const { runMigrations } = require('./migrate');
  await runMigrations();
}

async function closePool() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

module.exports = { getPool, query, queryOne, queryAll, execute, withTransaction, initSchema, closePool };
