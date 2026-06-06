-- ── Workspaces ────────────────────────────────────────────────────────────────
CREATE TABLE workspaces (
  id         TEXT        PRIMARY KEY,
  name       TEXT        NOT NULL,
  slug       TEXT        UNIQUE NOT NULL,
  logo_url   TEXT,
  plan       TEXT        NOT NULL DEFAULT 'free'
    CHECK (plan IN ('free','pro','team')),
  owner_id   TEXT        REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE workspace_members (
  workspace_id TEXT        NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id      TEXT        NOT NULL REFERENCES users(id)      ON DELETE CASCADE,
  role         TEXT        NOT NULL DEFAULT 'member'
    CHECK (role IN ('owner','admin','member')),
  joined_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (workspace_id, user_id)
);

CREATE INDEX idx_workspace_members_user ON workspace_members(user_id);

-- Add workspace_id to projects
ALTER TABLE projects ADD COLUMN workspace_id TEXT REFERENCES workspaces(id) ON DELETE CASCADE;
CREATE INDEX idx_projects_workspace ON projects(workspace_id);

-- ── Seed: create one workspace per existing user ──────────────────────────────
DO $$
DECLARE
  u              RECORD;
  ws_id          TEXT;
  slug_base      TEXT;
  slug_candidate TEXT;
  slug_counter   INT;
BEGIN
  FOR u IN SELECT id, name FROM users ORDER BY created_at LOOP
    ws_id := gen_random_uuid()::text;

    slug_base := LOWER(REGEXP_REPLACE(TRIM(u.name), '[^a-zA-Z0-9]+', '-', 'g'));
    slug_base := TRIM(BOTH '-' FROM slug_base);
    IF slug_base = '' THEN slug_base := 'workspace'; END IF;

    slug_candidate := slug_base;
    slug_counter   := 1;
    WHILE EXISTS (SELECT 1 FROM workspaces WHERE slug = slug_candidate) LOOP
      slug_candidate := slug_base || '-' || slug_counter;
      slug_counter   := slug_counter + 1;
    END LOOP;

    INSERT INTO workspaces (id, name, slug, owner_id)
    VALUES (ws_id, u.name || '''s Workspace', slug_candidate, u.id);

    INSERT INTO workspace_members (workspace_id, user_id, role)
    VALUES (ws_id, u.id, 'owner');

    -- Move this user's projects into their workspace
    UPDATE projects SET workspace_id = ws_id
    WHERE created_by = u.id AND workspace_id IS NULL;

    -- Pull existing project members into the workspace
    INSERT INTO workspace_members (workspace_id, user_id, role)
    SELECT DISTINCT ws_id, pm.user_id, 'member'
    FROM project_members pm
    JOIN projects p ON p.id = pm.project_id
    WHERE p.workspace_id = ws_id AND pm.user_id != u.id
    ON CONFLICT (workspace_id, user_id) DO NOTHING;
  END LOOP;
END $$;

-- Any projects still unassigned go to the first workspace
UPDATE projects
SET workspace_id = (SELECT id FROM workspaces ORDER BY created_at LIMIT 1)
WHERE workspace_id IS NULL;
