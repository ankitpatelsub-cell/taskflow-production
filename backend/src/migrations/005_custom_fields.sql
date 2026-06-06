CREATE TABLE IF NOT EXISTS custom_field_definitions (
  id         TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  type       TEXT NOT NULL CHECK (type IN ('text','number','select','date','checkbox','url')),
  options    JSONB,
  position   INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS custom_field_values (
  id         TEXT PRIMARY KEY,
  task_id    TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  field_id   TEXT NOT NULL REFERENCES custom_field_definitions(id) ON DELETE CASCADE,
  value      TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(task_id, field_id)
);

CREATE INDEX IF NOT EXISTS idx_cfd_project  ON custom_field_definitions(project_id);
CREATE INDEX IF NOT EXISTS idx_cfv_task     ON custom_field_values(task_id);
CREATE INDEX IF NOT EXISTS idx_cfv_field    ON custom_field_values(field_id);
