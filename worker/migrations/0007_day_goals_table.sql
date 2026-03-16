CREATE TABLE IF NOT EXISTS day_goals (
  id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  date TEXT NOT NULL,
  title TEXT NOT NULL,
  linked_task_id TEXT,
  position INTEGER NOT NULL DEFAULT 0,
  completed_at INTEGER,
  archived_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  deleted_at INTEGER,
  version INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (user_id, id)
);

CREATE INDEX IF NOT EXISTS idx_day_goals_user_date ON day_goals(user_id, date, position);
CREATE INDEX IF NOT EXISTS idx_day_goals_user_deleted ON day_goals(user_id, deleted_at);
CREATE INDEX IF NOT EXISTS idx_day_goals_user_updated ON day_goals(user_id, updated_at);

UPDATE schema_meta
SET latest_schema = 4,
    min_supported_client_schema = 4,
    updated_at = unixepoch() * 1000
WHERE id = 1;
