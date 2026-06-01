/**
 * Simple DB migration system.
 * Add a new entry to MIGRATIONS when you need to change the schema.
 * Each migration runs once and is recorded in the `schema_versions` table.
 */
const MIGRATIONS = [
  {
    version: 1,
    description: 'Initial schema',
    // Already handled by db.js applySchema()
    up: () => {},
  },
  {
    version: 2,
    description: 'Add user timezone column (if missing)',
    up: (db) => {
      const cols = db.prepare("PRAGMA table_info('users')").all().map((c) => c.name);
      if (!cols.includes('timezone')) {
        db.exec("ALTER TABLE users ADD COLUMN timezone TEXT DEFAULT 'UTC'");
      }
    },
  },
  {
    version: 3,
    description: 'Add estimated_hours to tasks (if missing)',
    up: (db) => {
      const cols = db.prepare("PRAGMA table_info('tasks')").all().map((c) => c.name);
      if (!cols.includes('estimated_hours')) {
        db.exec('ALTER TABLE tasks ADD COLUMN estimated_hours REAL');
      }
    },
  },
  {
    version: 4,
    description: 'Add recurrence columns to tasks',
    up: (db) => {
      const cols = db.prepare("PRAGMA table_info('tasks')").all().map((c) => c.name);
      if (!cols.includes('recurrence_rule'))     db.exec("ALTER TABLE tasks ADD COLUMN recurrence_rule TEXT");
      if (!cols.includes('recurrence_interval')) db.exec("ALTER TABLE tasks ADD COLUMN recurrence_interval INTEGER DEFAULT 1");
      if (!cols.includes('recurrence_days'))     db.exec("ALTER TABLE tasks ADD COLUMN recurrence_days TEXT");
      if (!cols.includes('recurrence_ends_at'))  db.exec("ALTER TABLE tasks ADD COLUMN recurrence_ends_at TEXT");
      if (!cols.includes('recurrence_parent_id'))db.exec("ALTER TABLE tasks ADD COLUMN recurrence_parent_id TEXT");
    },
  },
  {
    version: 5,
    description: 'Expand roles: super_admin, admin, project_manager, member, viewer; rename user→member',
    up: (db) => {
      db.pragma('foreign_keys = OFF');
      try {
        db.exec(`
          CREATE TABLE IF NOT EXISTS users_v5 (
            id            TEXT PRIMARY KEY,
            name          TEXT NOT NULL,
            email         TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            role          TEXT NOT NULL DEFAULT 'member'
                          CHECK(role IN ('super_admin','admin','project_manager','member','viewer')),
            avatar_url    TEXT,
            timezone      TEXT DEFAULT 'UTC',
            is_active     INTEGER NOT NULL DEFAULT 1,
            created_at    TEXT NOT NULL DEFAULT (datetime('now'))
          )
        `);
        db.exec(`
          INSERT INTO users_v5 (id, name, email, password_hash, role, avatar_url, timezone, is_active, created_at)
          SELECT id, name, email, password_hash,
                 CASE WHEN role = 'user' THEN 'member' ELSE role END,
                 avatar_url, timezone, is_active, created_at
          FROM users
        `);
        db.exec('DROP TABLE users');
        db.exec('ALTER TABLE users_v5 RENAME TO users');
      } finally {
        db.pragma('foreign_keys = ON');
      }
    },
  },
];

function runMigrations(db) {
  // Ensure version tracking table exists
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_versions (
      version     INTEGER PRIMARY KEY,
      description TEXT,
      applied_at  TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  const applied = new Set(
    db.prepare('SELECT version FROM schema_versions').all().map((r) => r.version)
  );

  let ran = 0;
  for (const migration of MIGRATIONS) {
    if (applied.has(migration.version)) continue;
    try {
      migration.up(db);
      db.prepare('INSERT INTO schema_versions (version, description) VALUES (?, ?)')
        .run(migration.version, migration.description);
      console.log(`[Migration] v${migration.version}: ${migration.description}`);
      ran++;
    } catch (err) {
      console.error(`[Migration] v${migration.version} FAILED:`, err.message);
      throw err;
    }
  }

  if (ran === 0) {
    console.log('[Migration] Database is up to date.');
  } else {
    console.log(`[Migration] Applied ${ran} migration(s).`);
  }
}

module.exports = { runMigrations };
