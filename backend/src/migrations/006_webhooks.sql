CREATE TABLE IF NOT EXISTS webhooks (
  id         TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  url        TEXT NOT NULL,
  events     JSONB NOT NULL DEFAULT '["task.created","task.updated","task.deleted"]',
  secret     TEXT,
  active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_webhooks_project ON webhooks(project_id);
