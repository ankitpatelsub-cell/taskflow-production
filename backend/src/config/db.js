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

async function initSchema() {
  const p = getPool();

  await p.query(`
    CREATE TABLE IF NOT EXISTS users (
      id             TEXT PRIMARY KEY,
      name           TEXT NOT NULL,
      email          TEXT NOT NULL UNIQUE,
      password_hash  TEXT,
      oauth_provider TEXT,
      oauth_id       TEXT,
      role           TEXT NOT NULL DEFAULT 'member'
                     CHECK(role IN ('super_admin','admin','project_manager','member','viewer')),
      avatar_url     TEXT,
      timezone       TEXT DEFAULT 'UTC',
      is_active      INTEGER NOT NULL DEFAULT 1,
      email_verified INTEGER NOT NULL DEFAULT 0,
      created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(oauth_provider, oauth_id)
    )
  `);

  await p.query(`
    CREATE TABLE IF NOT EXISTS refresh_tokens (
      id         TEXT PRIMARY KEY,
      user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await p.query(`
    CREATE TABLE IF NOT EXISTS projects (
      id          TEXT PRIMARY KEY,
      name        TEXT NOT NULL,
      description TEXT,
      color       TEXT DEFAULT '#6366f1',
      status      TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','archived')),
      created_by  TEXT NOT NULL REFERENCES users(id),
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await p.query(`
    CREATE TABLE IF NOT EXISTS project_members (
      id         TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      joined_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(project_id, user_id)
    )
  `);

  await p.query(`
    CREATE TABLE IF NOT EXISTS tasks (
      id                   TEXT PRIMARY KEY,
      project_id           TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      parent_task_id       TEXT REFERENCES tasks(id) ON DELETE CASCADE,
      title                TEXT NOT NULL,
      description          TEXT,
      status               TEXT NOT NULL DEFAULT 'todo'
                           CHECK(status IN ('todo','in_progress','review','done')),
      priority             TEXT NOT NULL DEFAULT 'medium'
                           CHECK(priority IN ('low','medium','high','critical')),
      assignee_id          TEXT REFERENCES users(id) ON DELETE SET NULL,
      created_by           TEXT NOT NULL REFERENCES users(id),
      deadline             TEXT,
      estimated_hours      REAL,
      position             INTEGER NOT NULL DEFAULT 0,
      recurrence_rule      TEXT,
      recurrence_interval  INTEGER DEFAULT 1,
      recurrence_days      TEXT,
      recurrence_ends_at   TEXT,
      recurrence_parent_id TEXT,
      created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await p.query(`
    CREATE TABLE IF NOT EXISTS tags (
      id         TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      name       TEXT NOT NULL,
      color      TEXT DEFAULT '#64748b',
      UNIQUE(project_id, name)
    )
  `);

  await p.query(`
    CREATE TABLE IF NOT EXISTS task_tags (
      id      TEXT PRIMARY KEY,
      task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      tag_id  TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
      UNIQUE(task_id, tag_id)
    )
  `);

  await p.query(`
    CREATE TABLE IF NOT EXISTS comments (
      id         TEXT PRIMARY KEY,
      task_id    TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      content    TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await p.query(`
    CREATE TABLE IF NOT EXISTS attachments (
      id         TEXT PRIMARY KEY,
      task_id    TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      user_id    TEXT NOT NULL REFERENCES users(id),
      filename   TEXT NOT NULL,
      filepath   TEXT NOT NULL,
      filesize   INTEGER NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await p.query(`
    CREATE TABLE IF NOT EXISTS activity_log (
      id          TEXT PRIMARY KEY,
      entity_type TEXT NOT NULL CHECK(entity_type IN ('task','project','comment')),
      entity_id   TEXT NOT NULL,
      user_id     TEXT REFERENCES users(id) ON DELETE SET NULL,
      action      TEXT NOT NULL,
      old_value   TEXT,
      new_value   TEXT,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await p.query(`
    CREATE TABLE IF NOT EXISTS notifications (
      id          TEXT PRIMARY KEY,
      user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type        TEXT NOT NULL,
      message     TEXT NOT NULL,
      entity_type TEXT,
      entity_id   TEXT,
      is_read     INTEGER NOT NULL DEFAULT 0,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await p.query(`
    CREATE TABLE IF NOT EXISTS backups (
      id         TEXT PRIMARY KEY,
      filename   TEXT NOT NULL,
      size_bytes INTEGER NOT NULL,
      created_by TEXT REFERENCES users(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      notes      TEXT
    )
  `);

  await p.query(`
    CREATE TABLE IF NOT EXISTS subscriptions (
      id                     TEXT PRIMARY KEY,
      stripe_customer_id     TEXT UNIQUE,
      stripe_subscription_id TEXT UNIQUE,
      plan                   TEXT NOT NULL DEFAULT 'free'
                             CHECK(plan IN ('free','pro','team')),
      status                 TEXT NOT NULL DEFAULT 'active',
      current_period_end     TIMESTAMPTZ,
      created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await p.query(`
    CREATE TABLE IF NOT EXISTS invite_tokens (
      id         TEXT PRIMARY KEY,
      email      TEXT NOT NULL,
      token      TEXT NOT NULL UNIQUE,
      project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
      invited_by TEXT REFERENCES users(id),
      role       TEXT NOT NULL DEFAULT 'member',
      expires_at TIMESTAMPTZ NOT NULL,
      used_at    TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await p.query(`
    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id         TEXT PRIMARY KEY,
      user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at TIMESTAMPTZ NOT NULL,
      used_at    TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await p.query(`
    CREATE TABLE IF NOT EXISTS time_logs (
      id               TEXT PRIMARY KEY,
      task_id          TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      user_id          TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      duration_minutes INTEGER NOT NULL CHECK(duration_minutes > 0),
      note             TEXT,
      logged_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await p.query(`CREATE INDEX IF NOT EXISTS idx_time_logs_task ON time_logs(task_id)`);
  await p.query(`CREATE INDEX IF NOT EXISTS idx_time_logs_user ON time_logs(user_id)`);

  await p.query(`
    CREATE TABLE IF NOT EXISTS email_verification_tokens (
      id         TEXT PRIMARY KEY,
      user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at TIMESTAMPTZ NOT NULL,
      used_at    TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  // Indexes for performance
  await p.query(`CREATE INDEX IF NOT EXISTS idx_tasks_project    ON tasks(project_id)`);
  await p.query(`CREATE INDEX IF NOT EXISTS idx_tasks_assignee   ON tasks(assignee_id)`);
  await p.query(`CREATE INDEX IF NOT EXISTS idx_tasks_proj_status ON tasks(project_id, status)`);
  await p.query(`CREATE INDEX IF NOT EXISTS idx_tasks_status     ON tasks(status)`);
  await p.query(`CREATE INDEX IF NOT EXISTS idx_project_members_user ON project_members(user_id)`);
  await p.query(`CREATE INDEX IF NOT EXISTS idx_comments_task    ON comments(task_id)`);
  await p.query(`CREATE INDEX IF NOT EXISTS idx_task_tags_task   ON task_tags(task_id)`);
  await p.query(`CREATE INDEX IF NOT EXISTS idx_task_tags_tag    ON task_tags(tag_id)`);
  await p.query(`CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read)`);
  await p.query(`CREATE INDEX IF NOT EXISTS idx_activity_entity  ON activity_log(entity_type, entity_id)`);
  await p.query(`CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id)`);
}

async function closePool() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

module.exports = { getPool, query, queryOne, queryAll, execute, withTransaction, initSchema, closePool };
