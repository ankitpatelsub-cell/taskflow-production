CREATE TABLE IF NOT EXISTS digest_subscriptions (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id  TEXT REFERENCES projects(id) ON DELETE CASCADE, -- NULL = all projects
  frequency   TEXT NOT NULL DEFAULT 'weekly' CHECK(frequency IN ('daily','weekly')),
  day_of_week INTEGER DEFAULT 1 CHECK(day_of_week BETWEEN 0 AND 6), -- 0=Sun, used for weekly
  hour_utc    INTEGER NOT NULL DEFAULT 8 CHECK(hour_utc BETWEEN 0 AND 23),
  include_overdue    BOOLEAN NOT NULL DEFAULT TRUE,
  include_due_soon   BOOLEAN NOT NULL DEFAULT TRUE,
  include_activity   BOOLEAN NOT NULL DEFAULT TRUE,
  include_sprints    BOOLEAN NOT NULL DEFAULT TRUE,
  last_sent_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, project_id, frequency)
);
CREATE INDEX IF NOT EXISTS idx_digest_user ON digest_subscriptions(user_id);
