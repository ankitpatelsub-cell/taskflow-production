CREATE TABLE IF NOT EXISTS objectives (
  id          TEXT PRIMARY KEY,
  project_id  TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  description TEXT,
  status      TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','completed','paused','archived')),
  start_date  DATE,
  end_date    DATE,
  color       TEXT NOT NULL DEFAULT '#6366f1',
  created_by  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS key_results (
  id            TEXT PRIMARY KEY,
  objective_id  TEXT NOT NULL REFERENCES objectives(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  current_value NUMERIC NOT NULL DEFAULT 0,
  target_value  NUMERIC NOT NULL DEFAULT 100,
  unit          TEXT NOT NULL DEFAULT '%',
  status        TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','completed','paused')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_objectives_project ON objectives(project_id);
CREATE INDEX IF NOT EXISTS idx_key_results_objective ON key_results(objective_id);
