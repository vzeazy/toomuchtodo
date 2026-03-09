PRAGMA foreign_keys = OFF;

CREATE TABLE projects_next (
  id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  color TEXT,
  parent_id TEXT,
  updated_at INTEGER NOT NULL,
  deleted_at INTEGER,
  version INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (user_id, id)
);

INSERT INTO projects_next (id, user_id, name, color, parent_id, updated_at, deleted_at, version)
SELECT id, user_id, name, color, parent_id, updated_at, deleted_at, version
FROM projects;

DROP TABLE projects;
ALTER TABLE projects_next RENAME TO projects;
CREATE INDEX idx_projects_user_updated ON projects(user_id, updated_at);
CREATE INDEX idx_projects_user_deleted ON projects(user_id, deleted_at);

CREATE TABLE tasks_next (
  id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL,
  is_starred INTEGER NOT NULL,
  project_id TEXT,
  area TEXT NOT NULL,
  due_date TEXT,
  day_part TEXT,
  parent_id TEXT,
  collapsed INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  tags TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  deleted_at INTEGER,
  version INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (user_id, id)
);

INSERT INTO tasks_next (id, user_id, title, description, status, is_starred, project_id, area, due_date, day_part, parent_id, collapsed, created_at, tags, updated_at, deleted_at, version)
SELECT id, user_id, title, description, status, is_starred, project_id, area, due_date, day_part, parent_id, collapsed, created_at, tags, updated_at, deleted_at, version
FROM tasks;

DROP TABLE tasks;
ALTER TABLE tasks_next RENAME TO tasks;
CREATE INDEX idx_tasks_user_updated ON tasks(user_id, updated_at);
CREATE INDEX idx_tasks_user_deleted ON tasks(user_id, deleted_at);
CREATE INDEX idx_tasks_user_due ON tasks(user_id, due_date);
CREATE INDEX idx_tasks_user_project ON tasks(user_id, project_id);

CREATE TABLE settings_next (
  id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  payload TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  deleted_at INTEGER,
  version INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (user_id, id)
);

INSERT INTO settings_next (id, user_id, payload, updated_at, deleted_at, version)
SELECT id, user_id, payload, updated_at, deleted_at, version
FROM settings;

DROP TABLE settings;
ALTER TABLE settings_next RENAME TO settings;
CREATE INDEX idx_settings_user_updated ON settings(user_id, updated_at);

CREATE TABLE themes_next (
  id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  payload TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  deleted_at INTEGER,
  version INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (user_id, id)
);

INSERT INTO themes_next (id, user_id, payload, updated_at, deleted_at, version)
SELECT id, user_id, payload, updated_at, deleted_at, version
FROM themes;

DROP TABLE themes;
ALTER TABLE themes_next RENAME TO themes;

PRAGMA foreign_keys = ON;
