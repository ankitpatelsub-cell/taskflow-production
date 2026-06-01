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
