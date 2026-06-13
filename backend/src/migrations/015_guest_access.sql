-- Guest access tokens: let project managers share read/comment access with external clients
CREATE TABLE IF NOT EXISTS guest_tokens (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  project_id  TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  label       TEXT NOT NULL,
  token       TEXT NOT NULL UNIQUE,
  permissions TEXT NOT NULL DEFAULT 'read',  -- 'read' | 'comment' | 'edit'
  created_by  TEXT NOT NULL REFERENCES users(id),
  expires_at  TIMESTAMPTZ,
  used_count  INTEGER NOT NULL DEFAULT 0,
  revoked_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_guest_tokens_project ON guest_tokens(project_id);
CREATE INDEX IF NOT EXISTS idx_guest_tokens_token   ON guest_tokens(token);
