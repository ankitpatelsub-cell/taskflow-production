-- Story points on tasks
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS story_points INTEGER;

-- Remove hardcoded status constraint so custom statuses work
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_status_check;

-- Custom workflow statuses per project
CREATE TABLE IF NOT EXISTS project_statuses (
  id          TEXT NOT NULL DEFAULT gen_random_uuid()::TEXT,
  project_id  TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  key         TEXT NOT NULL,
  color       TEXT NOT NULL DEFAULT '#6366f1',
  bg_color    TEXT NOT NULL DEFAULT '#eef2ff',
  position    INTEGER NOT NULL DEFAULT 0,
  is_default  BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (id),
  UNIQUE (project_id, key)
);

CREATE INDEX IF NOT EXISTS idx_project_statuses_project ON project_statuses(project_id, position);

-- Seed default statuses for every existing project
INSERT INTO project_statuses (project_id, name, key, color, bg_color, position, is_default)
SELECT p.id, s.name, s.key, s.color, s.bg_color, s.pos, s.is_def
FROM projects p
CROSS JOIN (VALUES
  ('To Do',       'todo',        '#6b7280', '#f3f4f6', 0, true),
  ('In Progress', 'in_progress', '#6366f1', '#eef2ff', 1, false),
  ('Review',      'review',      '#f59e0b', '#fffbeb', 2, false),
  ('Done',        'done',        '#10b981', '#ecfdf5', 3, false)
) AS s(name, key, color, bg_color, pos, is_def)
ON CONFLICT (project_id, key) DO NOTHING;
