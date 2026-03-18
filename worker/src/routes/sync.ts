import { Env, SyncOperation, UserSession } from '../types';
import { id, isAllowedOrigin, isMutation, json, now, parseJson, rateLimit } from '../lib';
import { getSchemaMeta } from '../db/schema';

type PreparedStatement = ReturnType<Env['DB']['prepare']>;

interface PushPayload {
  deviceId?: string;
  cursor?: string | null;
  ops?: SyncOperation[];
}

interface StoredRecord {
  version: number | null;
  record: Record<string, unknown> | null;
}

interface PushConflict {
  opId: string;
  entity: SyncOperation['entity'];
  action: SyncOperation['action'];
  recordId: string;
  reason: 'version_mismatch';
  clientVersion: number | null;
  serverVersion: number | null;
  serverRecord: Record<string, unknown> | null;
}

interface CompactedPushOp extends SyncOperation {
  sourceIds: string[];
}

interface ChangeLogCursorInfo {
  hasSequence: boolean;
  cursor: string;
  sequence: number | null;
  updatedAt: number | null;
  id: string | null;
}

const CHANGE_LOG_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_SQL_BIND_PARAMETERS = 100;
const MAX_IN_CLAUSE_IDS = MAX_SQL_BIND_PARAMETERS - 1; // reserve one bind for user_id
const SYNC_ENTITIES = ['task', 'project', 'note', 'dayGoal', 'settings'] as const;
type SyncEntity = (typeof SYNC_ENTITIES)[number];

const getCursor = (sequence: number) => `${sequence}`;
const getLegacyCursor = (updatedAt: number, opId: string) => `${updatedAt}:${opId}`;

const parseLegacyCursor = (cursor: string) => {
  const [tsRaw, opId] = cursor.split(':');
  return { ts: Number.parseInt(tsRaw || '0', 10) || 0, opId: opId || '' };
};

const buildInClause = (count: number) => Array.from({ length: count }, () => '?').join(', ');
const chunkValues = <T>(values: T[], size: number) => {
  const chunks: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
};

const batchRows = (result: unknown) => {
  const rows = (result as { results?: unknown[] } | null)?.results;
  return Array.isArray(rows) ? rows : [];
};

const getOpKey = (op: Pick<SyncOperation, 'entity' | 'recordId'>) => `${op.entity}:${op.recordId}`;

const toTaskRow = (record: Record<string, unknown>) => ({
  id: String(record.id || ''),
  title: String(record.title || ''),
  description: String(record.description || ''),
  status: String(record.status || 'inbox'),
  isStarred: Number(Boolean(record.isStarred)),
  projectId: record.projectId ? String(record.projectId) : null,
  area: String(record.area || 'Personal'),
  dueDate: record.dueDate ? String(record.dueDate) : null,
  dayPart: record.dayPart ? String(record.dayPart) : null,
  parentId: record.parentId ? String(record.parentId) : null,
  collapsed: Number(Boolean(record.collapsed)),
  createdAt: Number(record.createdAt || now()),
  tags: JSON.stringify(Array.isArray(record.tags) ? record.tags : []),
  updatedAt: Number(record.updatedAt || now()),
  deletedAt: typeof record.deletedAt === 'number' ? Number(record.deletedAt) : null,
});

const toProjectRow = (record: Record<string, unknown>) => ({
  id: String(record.id || ''),
  name: String(record.name || 'Untitled project'),
  color: record.color ? String(record.color) : null,
  parentId: record.parentId ? String(record.parentId) : null,
  updatedAt: Number(record.updatedAt || now()),
  deletedAt: typeof record.deletedAt === 'number' ? Number(record.deletedAt) : null,
});

const toNoteRow = (record: Record<string, unknown>) => ({
  id: String(record.id || ''),
  title: String(record.title || 'Untitled note'),
  body: String(record.body || ''),
  scopeType: String(record.scopeType || 'dashboard'),
  scopeRef: record.scopeRef ? String(record.scopeRef) : null,
  pinned: Number(Boolean(record.pinned)),
  createdAt: Number(record.createdAt || now()),
  updatedAt: Number(record.updatedAt || now()),
  deletedAt: typeof record.deletedAt === 'number' ? Number(record.deletedAt) : null,
});

const toDayGoalRow = (record: Record<string, unknown>) => ({
  id: String(record.id || ''),
  date: String(record.date || ''),
  title: String(record.title || 'Untitled goal'),
  linkedTaskId: record.linkedTaskId ? String(record.linkedTaskId) : null,
  position: Number(record.position || 0),
  completedAt: typeof record.completedAt === 'number' ? Number(record.completedAt) : null,
  archivedAt: typeof record.archivedAt === 'number' ? Number(record.archivedAt) : null,
  createdAt: Number(record.createdAt || now()),
  updatedAt: Number(record.updatedAt || now()),
  deletedAt: typeof record.deletedAt === 'number' ? Number(record.deletedAt) : null,
});

const registerDevice = async (env: Env, userId: string, deviceId: string) => {
  const ts = now();
  await env.DB.prepare(
    'INSERT INTO devices (id, user_id, created_at, last_seen_at) VALUES (?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET last_seen_at = excluded.last_seen_at',
  )
    .bind(deviceId, userId, ts, ts)
    .run();
};

const normalizeBaseVersion = (value: number | null | undefined) => (typeof value === 'number' ? value : null);

const taskRowToRecord = (row: any) => ({
  id: row.id,
  title: row.title,
  description: row.description,
  status: row.status,
  isStarred: Boolean(row.is_starred),
  projectId: row.project_id,
  area: row.area,
  dueDate: row.due_date,
  dayPart: row.day_part,
  parentId: row.parent_id,
  collapsed: Boolean(row.collapsed),
  createdAt: Number(row.created_at),
  tags: JSON.parse(String(row.tags || '[]')),
  updatedAt: Number(row.updated_at),
  deletedAt: row.deleted_at ? Number(row.deleted_at) : null,
  syncVersion: Number(row.version),
});

const projectRowToRecord = (row: any) => ({
  id: row.id,
  name: row.name,
  color: row.color || undefined,
  parentId: row.parent_id,
  updatedAt: Number(row.updated_at),
  deletedAt: row.deleted_at ? Number(row.deleted_at) : null,
  syncVersion: Number(row.version),
});

const noteRowToRecord = (row: any) => ({
  id: row.id,
  title: row.title,
  body: row.body,
  scopeType: row.scope_type,
  scopeRef: row.scope_ref,
  pinned: Boolean(row.pinned),
  createdAt: Number(row.created_at),
  updatedAt: Number(row.updated_at),
  deletedAt: row.deleted_at ? Number(row.deleted_at) : null,
  syncVersion: Number(row.version),
});

const dayGoalRowToRecord = (row: any) => ({
  id: row.id,
  date: row.date,
  title: row.title,
  linkedTaskId: row.linked_task_id,
  position: Number(row.position),
  completedAt: row.completed_at ? Number(row.completed_at) : null,
  archivedAt: row.archived_at ? Number(row.archived_at) : null,
  createdAt: Number(row.created_at),
  updatedAt: Number(row.updated_at),
  deletedAt: row.deleted_at ? Number(row.deleted_at) : null,
  syncVersion: Number(row.version),
});

const buildConflict = (op: SyncOperation, stored: StoredRecord): PushConflict => ({
  opId: op.id,
  entity: op.entity,
  action: op.action,
  recordId: op.recordId,
  reason: 'version_mismatch',
  clientVersion: normalizeBaseVersion(op.baseVersion),
  serverVersion: stored.version,
  serverRecord: stored.record,
});

const compactIncomingOps = (ops: SyncOperation[], deviceId: string) => {
  const compacted: CompactedPushOp[] = [];
  const indexByKey = new Map<string, number>();

  for (const op of ops) {
    const opId = op.id || id('op');
    const normalized: CompactedPushOp = {
      ...op,
      id: opId,
      deviceId,
      sourceIds: [opId],
    };
    const key = getOpKey(normalized);
    const existingIndex = indexByKey.get(key);
    if (existingIndex === undefined) {
      indexByKey.set(key, compacted.length);
      compacted.push(normalized);
      continue;
    }

    const existing = compacted[existingIndex];
    compacted[existingIndex] = {
      ...normalized,
      baseVersion: typeof existing.baseVersion === 'number'
        ? existing.baseVersion
        : normalizeBaseVersion(normalized.baseVersion),
      sourceIds: [...existing.sourceIds, ...normalized.sourceIds],
    };
  }

  return compacted;
};

const hasSequenceColumn = async (env: Env) => {
  const columns = await env.DB.prepare("PRAGMA table_info('change_log')").all<{ name: string }>();
  return (columns.results || []).some((column) => String((column as { name?: string }).name || '') === 'sequence');
};

const hasTable = async (env: Env, name: string) => {
  const row = await env.DB.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?")
    .bind(name)
    .first<{ name: string }>();
  return Boolean(row?.name);
};

const readLatestCursorInfo = async (env: Env, userId: string): Promise<ChangeLogCursorInfo> => {
  const hasSequence = await hasSequenceColumn(env);

  if (hasSequence) {
    const latest = await env.DB.prepare('SELECT sequence FROM change_log WHERE user_id = ? ORDER BY sequence DESC LIMIT 1')
      .bind(userId)
      .first<{ sequence: number }>();
    const sequence = Number(latest?.sequence || 0);
    return {
      hasSequence,
      cursor: getCursor(sequence),
      sequence,
      updatedAt: null,
      id: null,
    };
  }

  const latest = await env.DB.prepare('SELECT updated_at as updatedAt, id FROM change_log WHERE user_id = ? ORDER BY updated_at DESC, id DESC LIMIT 1')
    .bind(userId)
    .first<{ updatedAt: number; id: string }>();
  const updatedAt = latest?.updatedAt ? Number(latest.updatedAt) : 0;
  const id = latest?.id ? String(latest.id) : '';
  return {
    hasSequence,
    cursor: latest ? getLegacyCursor(updatedAt, id) : getCursor(0),
    sequence: null,
    updatedAt: latest ? updatedAt : null,
    id: latest ? id : null,
  };
};

const resolveCursorInfo = async (env: Env, userId: string, rawCursor: string | null): Promise<ChangeLogCursorInfo> => {
  const hasSequence = await hasSequenceColumn(env);
  if (!rawCursor) {
    return {
      hasSequence,
      cursor: getCursor(0),
      sequence: 0,
      updatedAt: null,
      id: null,
    };
  }

  if (hasSequence && /^\d+$/.test(rawCursor)) {
    return {
      hasSequence,
      cursor: rawCursor,
      sequence: Number.parseInt(rawCursor, 10) || 0,
      updatedAt: null,
      id: null,
    };
  }

  const legacy = parseLegacyCursor(rawCursor);
  if (!legacy.ts || !legacy.opId) {
    return {
      hasSequence,
      cursor: getCursor(0),
      sequence: hasSequence ? 0 : null,
      updatedAt: null,
      id: null,
    };
  }

  if (hasSequence) {
    const exact = await env.DB.prepare(
      'SELECT sequence FROM change_log WHERE user_id = ? AND updated_at = ? AND id = ? LIMIT 1',
    )
      .bind(userId, legacy.ts, legacy.opId)
      .first<{ sequence: number }>();

    if (exact?.sequence) {
      return {
        hasSequence,
        cursor: getCursor(Number(exact.sequence)),
        sequence: Number(exact.sequence),
        updatedAt: legacy.ts,
        id: legacy.opId,
      };
    }

    const approximate = await env.DB.prepare(
      `SELECT COALESCE(MAX(sequence), 0) as sequence
       FROM change_log
       WHERE user_id = ?
         AND (updated_at < ? OR (updated_at = ? AND id <= ?))`,
    )
      .bind(userId, legacy.ts, legacy.ts, legacy.opId)
      .first<{ sequence: number }>();

    return {
      hasSequence,
      cursor: getCursor(Number(approximate?.sequence || 0)),
      sequence: Number(approximate?.sequence || 0),
      updatedAt: legacy.ts,
      id: legacy.opId,
    };
  }

  return {
    hasSequence,
    cursor: rawCursor,
    sequence: null,
    updatedAt: legacy.ts,
    id: legacy.opId,
  };
};

const readCurrentRecords = async (env: Env, userId: string, ops: CompactedPushOp[]) => {
  const statements: PreparedStatement[] = [];
  const statementEntities: SyncEntity[] = [];
  const groups = new Map<SyncEntity, Set<string>>();

  for (const op of ops) {
    const entity: SyncEntity = op.entity;
    const ids = groups.get(entity) || new Set<string>();
    ids.add(op.recordId);
    groups.set(entity, ids);
  }

  for (const entity of SYNC_ENTITIES) {
    const idSet = groups.get(entity);
    if (!idSet?.size) continue;
    const ids = Array.from(idSet);
    const idChunks = chunkValues(ids, MAX_IN_CLAUSE_IDS);

    for (const idChunk of idChunks) {
      const inClause = buildInClause(idChunk.length);
      if (entity === 'task') {
        statements.push(env.DB.prepare(`SELECT * FROM tasks WHERE user_id = ? AND id IN (${inClause})`).bind(userId, ...idChunk));
        statementEntities.push(entity);
        continue;
      }
      if (entity === 'project') {
        statements.push(env.DB.prepare(`SELECT * FROM projects WHERE user_id = ? AND id IN (${inClause})`).bind(userId, ...idChunk));
        statementEntities.push(entity);
        continue;
      }
      if (entity === 'note') {
        statements.push(env.DB.prepare(`SELECT * FROM notes WHERE user_id = ? AND id IN (${inClause})`).bind(userId, ...idChunk));
        statementEntities.push(entity);
        continue;
      }
      if (entity === 'dayGoal') {
        statements.push(env.DB.prepare(`SELECT * FROM day_goals WHERE user_id = ? AND id IN (${inClause})`).bind(userId, ...idChunk));
        statementEntities.push(entity);
        continue;
      }
      statements.push(
        env.DB.prepare(`SELECT id, payload, version FROM settings WHERE user_id = ? AND id IN (${inClause})`).bind(userId, ...idChunk),
      );
      statementEntities.push(entity);
    }
  }

  if (!statements.length) return new Map<string, StoredRecord>();

  const results = await env.DB.batch(statements);
  const currentRecords = new Map<string, StoredRecord>();
  for (const [resultIndex, result] of results.entries()) {
    const entity = statementEntities[resultIndex];
    if (!entity) continue;
    const rows = batchRows(result);

    for (const row of rows as any[]) {
      if (entity === 'task') {
        currentRecords.set(`${entity}:${row.id}`, { version: Number(row.version), record: taskRowToRecord(row) });
        continue;
      }
      if (entity === 'project') {
        currentRecords.set(`${entity}:${row.id}`, { version: Number(row.version), record: projectRowToRecord(row) });
        continue;
      }
      if (entity === 'note') {
        currentRecords.set(`${entity}:${row.id}`, { version: Number(row.version), record: noteRowToRecord(row) });
        continue;
      }
      if (entity === 'dayGoal') {
        currentRecords.set(`${entity}:${row.id}`, { version: Number(row.version), record: dayGoalRowToRecord(row) });
        continue;
      }
      currentRecords.set(`${entity}:${row.id}`, {
        version: Number(row.version),
        record: JSON.parse(String(row.payload || '{}')) as Record<string, unknown>,
      });
    }
  }

  return currentRecords;
};

const buildWriteStatements = (
  env: Env,
  userId: string,
  op: CompactedPushOp,
  current: StoredRecord,
) => {
  const ts = op.timestamp || now();
  const nextVersion = (current.version || 0) + 1;
  let changePayload: Record<string, unknown> = {};
  const statements: PreparedStatement[] = [];

  if (op.entity === 'task') {
    if (op.action === 'delete') {
      changePayload = { deletedAt: ts };
      statements.push(
        env.DB.prepare('UPDATE tasks SET deleted_at = ?, updated_at = ?, version = ? WHERE id = ? AND user_id = ?')
          .bind(ts, ts, nextVersion, op.recordId, userId),
      );
    } else {
      const task = toTaskRow(op.payload || {});
      changePayload = {
        id: task.id || op.recordId,
        title: task.title,
        description: task.description,
        status: task.status,
        isStarred: Boolean(task.isStarred),
        projectId: task.projectId,
        area: task.area,
        dueDate: task.dueDate,
        dayPart: task.dayPart,
        parentId: task.parentId,
        collapsed: Boolean(task.collapsed),
        createdAt: task.createdAt,
        tags: JSON.parse(task.tags),
        updatedAt: task.updatedAt,
        deletedAt: task.deletedAt,
      };
      statements.push(
        env.DB.prepare(
          `INSERT INTO tasks (id, user_id, title, description, status, is_starred, project_id, area, due_date, day_part, parent_id, collapsed, created_at, tags, updated_at, deleted_at, version)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(user_id, id) DO UPDATE SET
           title=excluded.title,
           description=excluded.description,
           status=excluded.status,
           is_starred=excluded.is_starred,
           project_id=excluded.project_id,
           area=excluded.area,
           due_date=excluded.due_date,
           day_part=excluded.day_part,
           parent_id=excluded.parent_id,
           collapsed=excluded.collapsed,
           tags=excluded.tags,
           updated_at=excluded.updated_at,
           deleted_at=excluded.deleted_at,
           version=excluded.version`,
        )
          .bind(task.id || op.recordId, userId, task.title, task.description, task.status, task.isStarred, task.projectId, task.area, task.dueDate, task.dayPart, task.parentId, task.collapsed, task.createdAt, task.tags, task.updatedAt, task.deletedAt, nextVersion),
      );
    }
  } else if (op.entity === 'project') {
    if (op.action === 'delete') {
      changePayload = { deletedAt: ts };
      statements.push(
        env.DB.prepare('UPDATE projects SET deleted_at = ?, updated_at = ?, version = ? WHERE id = ? AND user_id = ?')
          .bind(ts, ts, nextVersion, op.recordId, userId),
      );
    } else {
      const project = toProjectRow(op.payload || {});
      changePayload = {
        id: project.id || op.recordId,
        name: project.name,
        color: project.color || undefined,
        parentId: project.parentId,
        updatedAt: project.updatedAt,
        deletedAt: project.deletedAt,
      };
      statements.push(
        env.DB.prepare(
          `INSERT INTO projects (id, user_id, name, color, parent_id, updated_at, deleted_at, version)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(user_id, id) DO UPDATE SET
           name=excluded.name,
           color=excluded.color,
           parent_id=excluded.parent_id,
           updated_at=excluded.updated_at,
           deleted_at=excluded.deleted_at,
           version=excluded.version`,
        )
          .bind(project.id || op.recordId, userId, project.name, project.color, project.parentId, project.updatedAt, project.deletedAt, nextVersion),
      );
    }
  } else if (op.entity === 'note') {
    if (op.action === 'delete') {
      changePayload = { deletedAt: ts };
      statements.push(
        env.DB.prepare('UPDATE notes SET deleted_at = ?, updated_at = ?, version = ? WHERE id = ? AND user_id = ?')
          .bind(ts, ts, nextVersion, op.recordId, userId),
      );
    } else {
      const note = toNoteRow(op.payload || {});
      changePayload = {
        id: note.id || op.recordId,
        title: note.title,
        body: note.body,
        scopeType: note.scopeType,
        scopeRef: note.scopeRef,
        pinned: Boolean(note.pinned),
        createdAt: note.createdAt,
        updatedAt: note.updatedAt,
        deletedAt: note.deletedAt,
      };
      statements.push(
        env.DB.prepare(
          `INSERT INTO notes (id, user_id, title, body, scope_type, scope_ref, pinned, created_at, updated_at, deleted_at, version)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(user_id, id) DO UPDATE SET
           title=excluded.title,
           body=excluded.body,
           scope_type=excluded.scope_type,
           scope_ref=excluded.scope_ref,
           pinned=excluded.pinned,
           updated_at=excluded.updated_at,
           deleted_at=excluded.deleted_at,
           version=excluded.version`,
        )
          .bind(note.id || op.recordId, userId, note.title, note.body, note.scopeType, note.scopeRef, note.pinned, note.createdAt, note.updatedAt, note.deletedAt, nextVersion),
      );
    }
  } else if (op.entity === 'dayGoal') {
    if (op.action === 'delete') {
      changePayload = { deletedAt: ts };
      statements.push(
        env.DB.prepare('UPDATE day_goals SET deleted_at = ?, updated_at = ?, version = ? WHERE id = ? AND user_id = ?')
          .bind(ts, ts, nextVersion, op.recordId, userId),
      );
    } else {
      const dayGoal = toDayGoalRow(op.payload || {});
      changePayload = {
        id: dayGoal.id || op.recordId,
        date: dayGoal.date,
        title: dayGoal.title,
        linkedTaskId: dayGoal.linkedTaskId,
        position: dayGoal.position,
        completedAt: dayGoal.completedAt,
        archivedAt: dayGoal.archivedAt,
        createdAt: dayGoal.createdAt,
        updatedAt: dayGoal.updatedAt,
        deletedAt: dayGoal.deletedAt,
      };
      statements.push(
        env.DB.prepare(
          `INSERT INTO day_goals (id, user_id, date, title, linked_task_id, position, completed_at, archived_at, created_at, updated_at, deleted_at, version)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(user_id, id) DO UPDATE SET
           date=excluded.date,
           title=excluded.title,
           linked_task_id=excluded.linked_task_id,
           position=excluded.position,
           completed_at=excluded.completed_at,
           archived_at=excluded.archived_at,
           updated_at=excluded.updated_at,
           deleted_at=excluded.deleted_at,
           version=excluded.version`,
        )
          .bind(
            dayGoal.id || op.recordId,
            userId,
            dayGoal.date,
            dayGoal.title,
            dayGoal.linkedTaskId,
            dayGoal.position,
            dayGoal.completedAt,
            dayGoal.archivedAt,
            dayGoal.createdAt,
            dayGoal.updatedAt,
            dayGoal.deletedAt,
            nextVersion,
          ),
      );
    }
  } else if (op.action === 'upsert') {
    changePayload = { ...(op.payload || {}) };
    statements.push(
      env.DB.prepare(
        `INSERT INTO settings (id, user_id, payload, updated_at, deleted_at, version)
         VALUES (?, ?, ?, ?, NULL, ?)
         ON CONFLICT(user_id, id) DO UPDATE SET
         payload=excluded.payload,
         updated_at=excluded.updated_at,
         deleted_at=excluded.deleted_at,
         version=excluded.version`,
      )
        .bind('settings', userId, JSON.stringify(op.payload || {}), ts, nextVersion),
    );
  }

  statements.push(
    env.DB.prepare(
      'INSERT INTO change_log (id, user_id, device_id, entity, record_id, action, payload, updated_at, version) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    )
      .bind(op.id, userId, op.deviceId || 'unknown', op.entity, op.recordId, op.action, JSON.stringify(changePayload), ts, nextVersion),
  );

  return statements;
};

const readSnapshot = async (env: Env, userId: string) => {
  const hasDayGoalsTable = await hasTable(env, 'day_goals');
  const [tasksRes, projectsRes, notesRes, dayGoalsRes, settingsRow] = await Promise.all([
    env.DB.prepare('SELECT * FROM tasks WHERE user_id = ? AND deleted_at IS NULL').bind(userId).all(),
    env.DB.prepare('SELECT * FROM projects WHERE user_id = ? AND deleted_at IS NULL').bind(userId).all(),
    env.DB.prepare('SELECT * FROM notes WHERE user_id = ? AND deleted_at IS NULL').bind(userId).all(),
    hasDayGoalsTable
      ? env.DB.prepare('SELECT * FROM day_goals WHERE user_id = ? AND deleted_at IS NULL').bind(userId).all()
      : Promise.resolve({ results: [] as any[] }),
    env.DB.prepare('SELECT payload, version FROM settings WHERE user_id = ? AND id = ? AND deleted_at IS NULL').bind(userId, 'settings').first<{ payload: string; version: number }>(),
  ]);

  const tasks = (tasksRes.results || []).map((row: any) => ({
    id: row.id,
    title: row.title,
    description: row.description,
    status: row.status,
    isStarred: Boolean(row.is_starred),
    projectId: row.project_id,
    area: row.area,
    dueDate: row.due_date,
    dayPart: row.day_part,
    parentId: row.parent_id,
    collapsed: Boolean(row.collapsed),
    createdAt: Number(row.created_at),
    tags: JSON.parse(String(row.tags || '[]')),
    updatedAt: Number(row.updated_at),
    deletedAt: row.deleted_at ? Number(row.deleted_at) : null,
    syncVersion: Number(row.version),
  }));

  const projects = (projectsRes.results || []).map((row: any) => ({
    id: row.id,
    name: row.name,
    color: row.color || undefined,
    parentId: row.parent_id,
    updatedAt: Number(row.updated_at),
    deletedAt: row.deleted_at ? Number(row.deleted_at) : null,
    syncVersion: Number(row.version),
  }));

  const notes = (notesRes.results || []).map((row: any) => ({
    id: row.id,
    title: row.title,
    body: row.body,
    scopeType: row.scope_type,
    scopeRef: row.scope_ref,
    pinned: Boolean(row.pinned),
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
    deletedAt: row.deleted_at ? Number(row.deleted_at) : null,
    syncVersion: Number(row.version),
  }));

  const dayGoals = (dayGoalsRes.results || []).map((row: any) => ({
    id: row.id,
    date: row.date,
    title: row.title,
    linkedTaskId: row.linked_task_id,
    position: Number(row.position),
    completedAt: row.completed_at ? Number(row.completed_at) : null,
    archivedAt: row.archived_at ? Number(row.archived_at) : null,
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
    deletedAt: row.deleted_at ? Number(row.deleted_at) : null,
    syncVersion: Number(row.version),
  }));

  const settings = settingsRow ? JSON.parse(settingsRow.payload) : {};

  return { tasks, projects, notes, dayGoals, settings, settingsVersion: settingsRow ? Number(settingsRow.version) : null };
};

export const pruneChangeLog = async (env: Env, retentionMs = CHANGE_LOG_RETENTION_MS) => {
  const cutoff = now() - retentionMs;
  await env.DB.prepare('DELETE FROM change_log WHERE updated_at < ?').bind(cutoff).run();
};

const applySecurity = (env: Env, request: Request, session: UserSession) => {
  if (isMutation(request.method) && !isAllowedOrigin(env, request)) {
    return json({ error: 'forbidden_origin' }, { status: 403 });
  }
  const ip = request.headers.get('cf-connecting-ip') || 'unknown';
  if (!rateLimit(`sync:${session.userId}:${ip}`, 240, 60_000)) {
    return json({ error: 'rate_limited' }, { status: 429 });
  }
  return null;
};

export const syncRoutes = {
  async bootstrap(env: Env, request: Request, session: UserSession) {
    const security = applySecurity(env, request, session);
    if (security) return security;

    const schema = await getSchemaMeta(env);
    const snapshot = await readSnapshot(env, session.userId);
    const latestCursor = await readLatestCursorInfo(env, session.userId);

    return json({
      serverTime: now(),
      cursor: latestCursor.cursor,
      snapshot,
      settingsVersion: snapshot.settingsVersion,
      schema,
    });
  },

  async push(env: Env, request: Request, session: UserSession) {
    const security = applySecurity(env, request, session);
    if (security) return security;

    const payload = await parseJson<PushPayload>(request);
    const deviceId = (payload?.deviceId || '').trim();
    if (!deviceId) return json({ error: 'invalid_device_id' }, { status: 400 });

    await registerDevice(env, session.userId, deviceId);

    const ops = Array.isArray(payload?.ops)
      ? payload.ops.filter((op): op is SyncOperation => Boolean(op?.recordId && op?.entity && op?.action && op?.id))
      : [];
    const duplicateIds = ops.map((op) => op.id);
    const duplicateIdSet = new Set<string>();
    if (duplicateIds.length) {
      const duplicateChunks = chunkValues(Array.from(new Set(duplicateIds)), MAX_IN_CLAUSE_IDS);
      for (const duplicateChunk of duplicateChunks) {
        const duplicateQuery = await env.DB.prepare(
          `SELECT id FROM change_log WHERE user_id = ? AND id IN (${buildInClause(duplicateChunk.length)})`,
        )
          .bind(session.userId, ...duplicateChunk)
          .all<{ id: string }>();
        for (const row of duplicateQuery.results || []) duplicateIdSet.add(String(row.id));
      }
    }

    const pendingOps = compactIncomingOps(ops.filter((op) => !duplicateIdSet.has(op.id)), deviceId);
    const acceptedOpIds: string[] = duplicateIds.filter((opId) => duplicateIdSet.has(opId));
    const conflicts: PushConflict[] = [];

    const currentRecords = await readCurrentRecords(env, session.userId, pendingOps);
    const writeStatements: PreparedStatement[] = [];

    for (const op of pendingOps) {
      const current = currentRecords.get(getOpKey(op)) || { version: null, record: null };
      const baseVersion = normalizeBaseVersion(op.baseVersion);
      if (current.version !== baseVersion) {
        conflicts.push(...op.sourceIds.map((sourceId) => ({ ...buildConflict(op, current), opId: sourceId })));
        continue;
      }

      if (op.entity !== 'settings' && op.action === 'delete' && !current.record) {
        acceptedOpIds.push(...op.sourceIds);
        continue;
      }

      if (op.entity === 'settings' && op.action !== 'upsert') {
        acceptedOpIds.push(...op.sourceIds);
        continue;
      }

      acceptedOpIds.push(...op.sourceIds);
      writeStatements.push(...buildWriteStatements(env, session.userId, op, current));
    }

    if (writeStatements.length) {
      await env.DB.batch(writeStatements);
    }

    const latestCursor = await readLatestCursorInfo(env, session.userId);

    return json({
      accepted: acceptedOpIds.length,
      acceptedOpIds,
      conflicts,
      cursor: latestCursor.cursor,
    });
  },

  async pull(env: Env, request: Request, session: UserSession) {
    const security = applySecurity(env, request, session);
    if (security) return security;

    const schema = await getSchemaMeta(env);
    const url = new URL(request.url);
    const cursorInfo = await resolveCursorInfo(env, session.userId, url.searchParams.get('cursor'));
    const rows = cursorInfo.hasSequence
      ? await env.DB.prepare(
        `SELECT sequence, id, entity, record_id as recordId, action, payload, updated_at as updatedAt, device_id as deviceId, version
         FROM change_log
         WHERE user_id = ?
           AND sequence > ?
         ORDER BY sequence ASC
         LIMIT 500`,
      )
        .bind(session.userId, cursorInfo.sequence || 0)
        .all()
      : await env.DB.prepare(
        `SELECT id, entity, record_id as recordId, action, payload, updated_at as updatedAt, device_id as deviceId, version
         FROM change_log
         WHERE user_id = ?
           AND (
             updated_at > ?
             OR (updated_at = ? AND id > ?)
           )
         ORDER BY updated_at ASC, id ASC
         LIMIT 500`,
      )
        .bind(session.userId, cursorInfo.updatedAt || 0, cursorInfo.updatedAt || 0, cursorInfo.id || '')
        .all();

    const changes = (rows.results || []).map((row: any) => ({
      id: row.id,
      entity: row.entity,
      action: row.action,
      recordId: row.recordId,
      payload: JSON.parse(String(row.payload || '{}')),
      deviceId: row.deviceId,
      timestamp: Number(row.updatedAt),
      version: typeof row.version === 'number' ? Number(row.version) : null,
    }));

    const lastRow = (rows.results || [])[Math.max(0, (rows.results || []).length - 1)] as { sequence?: number; updatedAt?: number; id?: string } | undefined;

    return json({
      cursor: cursorInfo.hasSequence
        ? (lastRow?.sequence ? getCursor(Number(lastRow.sequence)) : getCursor(cursorInfo.sequence || 0))
        : (lastRow?.updatedAt && lastRow?.id
          ? getLegacyCursor(Number(lastRow.updatedAt), String(lastRow.id))
          : (cursorInfo.updatedAt && cursorInfo.id ? getLegacyCursor(cursorInfo.updatedAt, cursorInfo.id) : getCursor(0))),
      changes,
      stats: { conflicts: 0 },
      schema,
    });
  },
};
