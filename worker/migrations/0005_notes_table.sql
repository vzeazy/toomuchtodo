CREATE TABLE IF NOT EXISTS notes (
  id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  scope_type TEXT NOT NULL,
  scope_ref TEXT,
  pinned INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  deleted_at INTEGER,
  version INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (user_id, id)
);

CREATE INDEX IF NOT EXISTS idx_notes_user_updated ON notes(user_id, updated_at);
CREATE INDEX IF NOT EXISTS idx_notes_user_deleted ON notes(user_id, deleted_at);
CREATE INDEX IF NOT EXISTS idx_notes_user_scope ON notes(user_id, scope_type, scope_ref);

UPDATE schema_meta
SET latest_schema = 3,
    min_supported_client_schema = 3,
    updated_at = unixepoch() * 1000
WHERE id = 1;
