// PostgreSQL schema is managed entirely by db.js initSchema().
// This file is kept for compatibility but migrations are no-ops.
// Future schema changes should be additive ALTER TABLE statements.

async function runMigrations() {
  // Schema creation is handled by initSchema() in db.js
  console.log('[Migration] PostgreSQL schema managed by initSchema().');
}

module.exports = { runMigrations };
