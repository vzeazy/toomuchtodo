CREATE TABLE change_log_next (
  sequence INTEGER PRIMARY KEY AUTOINCREMENT,
  id TEXT NOT NULL UNIQUE,
  user_id TEXT NOT NULL,
  device_id TEXT NOT NULL,
  entity TEXT NOT NULL,
  record_id TEXT NOT NULL,
  action TEXT NOT NULL,
  payload TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  version INTEGER
);

INSERT INTO change_log_next (id, user_id, device_id, entity, record_id, action, payload, updated_at, version)
SELECT id, user_id, device_id, entity, record_id, action, payload, updated_at, version
FROM change_log
ORDER BY updated_at ASC, id ASC;

DROP TABLE change_log;
ALTER TABLE change_log_next RENAME TO change_log;

CREATE UNIQUE INDEX idx_change_log_id ON change_log(id);
CREATE INDEX idx_change_log_user_sequence ON change_log(user_id, sequence);
CREATE INDEX idx_change_log_user_updated ON change_log(user_id, updated_at, id);
