-- Allow guest comments: make user_id nullable and add guest_author field
ALTER TABLE comments ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE comments ALTER COLUMN user_id DROP DEFAULT;

DO $$ BEGIN
  ALTER TABLE comments ADD COLUMN guest_author TEXT;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

-- Drop old FK constraint so we can null user_id
ALTER TABLE comments DROP CONSTRAINT IF EXISTS comments_user_id_fkey;
ALTER TABLE comments ADD CONSTRAINT comments_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  DEFERRABLE INITIALLY DEFERRED;
