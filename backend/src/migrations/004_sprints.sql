CREATE TABLE IF NOT EXISTS sprints (
  id          TEXT PRIMARY KEY,
  project_id  TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  goal        TEXT,
  start_date  DATE,
  end_date    DATE,
  status      TEXT NOT NULL DEFAULT 'planning' CHECK (status IN ('planning','active','completed')),
  created_by  TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS sprint_id TEXT REFERENCES sprints(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_sprints_project ON sprints(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_sprint    ON tasks(sprint_id);
