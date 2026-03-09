import { Env, SyncOperation, UserSession } from '../types';
import { id, isAllowedOrigin, isMutation, json, now, parseJson, rateLimit } from '../lib';
import { getSchemaMeta } from '../db/schema';

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

const getCursor = (ts: number, opId: string) => `${ts}:${opId}`;

const parseCursor = (cursor: string | null) => {
  if (!cursor) return { ts: 0, opId: '' };
  const [tsRaw, opId] = cursor.split(':');
  return { ts: Number.parseInt(tsRaw || '0', 10) || 0, opId: opId || '' };
};

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

const readCurrentRecord = async (
  env: Env,
  userId: string,
  entity: SyncOperation['entity'],
  recordId: string,
): Promise<StoredRecord> => {
  if (entity === 'task') {
    const row = await env.DB.prepare('SELECT * FROM tasks WHERE user_id = ? AND id = ?')
      .bind(userId, recordId)
      .first<any>();
    return row ? { version: Number(row.version), record: taskRowToRecord(row) } : { version: null, record: null };
  }

  if (entity === 'project') {
    const row = await env.DB.prepare('SELECT * FROM projects WHERE user_id = ? AND id = ?')
      .bind(userId, recordId)
      .first<any>();
    return row ? { version: Number(row.version), record: projectRowToRecord(row) } : { version: null, record: null };
  }

  if (entity === 'note') {
    const row = await env.DB.prepare('SELECT * FROM notes WHERE user_id = ? AND id = ?')
      .bind(userId, recordId)
      .first<any>();
    return row ? { version: Number(row.version), record: noteRowToRecord(row) } : { version: null, record: null };
  }

  const row = await env.DB.prepare('SELECT payload, version FROM settings WHERE user_id = ? AND id = ?')
    .bind(userId, recordId)
    .first<{ payload: string; version: number }>();
  return row
    ? { version: Number(row.version), record: JSON.parse(row.payload) as Record<string, unknown> }
    : { version: null, record: null };
};

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

const pushOne = async (env: Env, userId: string, op: SyncOperation) => {
  const ts = op.timestamp || now();
  const opId = op.id || id('op');
  const duplicate = await env.DB.prepare('SELECT id FROM change_log WHERE user_id = ? AND id = ?')
    .bind(userId, opId)
    .first<{ id: string }>();
  if (duplicate) {
    return { accepted: true, conflict: null as PushConflict | null, opId };
  }

  const current = await readCurrentRecord(env, userId, op.entity, op.recordId);
  const baseVersion = normalizeBaseVersion(op.baseVersion);
  if (current.version !== baseVersion) {
    return { accepted: false, conflict: buildConflict(op, current), opId };
  }

  const nextVersion = (current.version || 0) + 1;
  let changePayload: Record<string, unknown>;

  if (op.entity === 'task') {
    if (op.action === 'delete') {
      if (!current.record) {
        return { accepted: true, conflict: null as PushConflict | null, opId };
      }
      changePayload = { deletedAt: ts };
      await env.DB.prepare('UPDATE tasks SET deleted_at = ?, updated_at = ?, version = ? WHERE id = ? AND user_id = ?')
        .bind(ts, ts, nextVersion, op.recordId, userId)
        .run();
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
      await env.DB.prepare(
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
        .bind(task.id || op.recordId, userId, task.title, task.description, task.status, task.isStarred, task.projectId, task.area, task.dueDate, task.dayPart, task.parentId, task.collapsed, task.createdAt, task.tags, task.updatedAt, task.deletedAt, nextVersion)
        .run();
    }
  } else if (op.entity === 'project') {
    if (op.action === 'delete') {
      if (!current.record) {
        return { accepted: true, conflict: null as PushConflict | null, opId };
      }
      changePayload = { deletedAt: ts };
      await env.DB.prepare('UPDATE projects SET deleted_at = ?, updated_at = ?, version = ? WHERE id = ? AND user_id = ?')
        .bind(ts, ts, nextVersion, op.recordId, userId)
        .run();
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
      await env.DB.prepare(
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
        .bind(project.id || op.recordId, userId, project.name, project.color, project.parentId, project.updatedAt, project.deletedAt, nextVersion)
        .run();
    }
  } else if (op.entity === 'note') {
    if (op.action === 'delete') {
      if (!current.record) {
        return { accepted: true, conflict: null as PushConflict | null, opId };
      }
      changePayload = { deletedAt: ts };
      await env.DB.prepare('UPDATE notes SET deleted_at = ?, updated_at = ?, version = ? WHERE id = ? AND user_id = ?')
        .bind(ts, ts, nextVersion, op.recordId, userId)
        .run();
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
      await env.DB.prepare(
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
        .bind(note.id || op.recordId, userId, note.title, note.body, note.scopeType, note.scopeRef, note.pinned, note.createdAt, note.updatedAt, note.deletedAt, nextVersion)
        .run();
    }
  } else {
    if (op.action !== 'upsert') {
      return { accepted: true, conflict: null as PushConflict | null, opId };
    }

    changePayload = { ...(op.payload || {}) };
    await env.DB.prepare(
      `INSERT INTO settings (id, user_id, payload, updated_at, deleted_at, version)
       VALUES (?, ?, ?, ?, NULL, ?)
       ON CONFLICT(user_id, id) DO UPDATE SET
       payload=excluded.payload,
       updated_at=excluded.updated_at,
       deleted_at=excluded.deleted_at,
       version=excluded.version`,
    )
      .bind('settings', userId, JSON.stringify(op.payload || {}), ts, nextVersion)
      .run();
  }

  await env.DB.prepare(
    'INSERT INTO change_log (id, user_id, device_id, entity, record_id, action, payload, updated_at, version) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
  )
    .bind(opId, userId, op.deviceId || 'unknown', op.entity, op.recordId, op.action, JSON.stringify(changePayload), ts, nextVersion)
    .run();

  return { accepted: true, conflict: null as PushConflict | null, opId };
};

const readSnapshot = async (env: Env, userId: string) => {
  const [tasksRes, projectsRes, notesRes, settingsRow] = await Promise.all([
    env.DB.prepare('SELECT * FROM tasks WHERE user_id = ? AND deleted_at IS NULL').bind(userId).all(),
    env.DB.prepare('SELECT * FROM projects WHERE user_id = ? AND deleted_at IS NULL').bind(userId).all(),
    env.DB.prepare('SELECT * FROM notes WHERE user_id = ? AND deleted_at IS NULL').bind(userId).all(),
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

  const settings = settingsRow ? JSON.parse(settingsRow.payload) : {};

  return { tasks, projects, notes, settings, settingsVersion: settingsRow ? Number(settingsRow.version) : null };
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

    const latestLog = await env.DB.prepare('SELECT id, updated_at as updatedAt FROM change_log WHERE user_id = ? ORDER BY updated_at DESC, id DESC LIMIT 1')
      .bind(session.userId)
      .first<{ id: string; updatedAt: number }>();

    return json({
      serverTime: now(),
      cursor: latestLog ? getCursor(Number(latestLog.updatedAt), latestLog.id) : '0:',
      snapshot,
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

    const ops = Array.isArray(payload?.ops) ? payload.ops : [];
    const acceptedOpIds: string[] = [];
    const conflicts: PushConflict[] = [];
    for (const op of ops) {
      const result = await pushOne(env, session.userId, { ...op, deviceId });
      if (result.accepted) {
        acceptedOpIds.push(result.opId);
        continue;
      }
      if (result.conflict) conflicts.push(result.conflict);
    }

    const latest = await env.DB.prepare('SELECT id, updated_at as updatedAt FROM change_log WHERE user_id = ? ORDER BY updated_at DESC, id DESC LIMIT 1')
      .bind(session.userId)
      .first<{ id: string; updatedAt: number }>();

    return json({
      accepted: acceptedOpIds.length,
      acceptedOpIds,
      conflicts,
      cursor: latest ? getCursor(Number(latest.updatedAt), latest.id) : '0:',
    });
  },

  async pull(env: Env, request: Request, session: UserSession) {
    const security = applySecurity(env, request, session);
    if (security) return security;

    const schema = await getSchemaMeta(env);
    const url = new URL(request.url);
    const cursor = parseCursor(url.searchParams.get('cursor'));

    const rows = await env.DB.prepare(
      `SELECT id, entity, record_id as recordId, action, payload, updated_at as updatedAt, device_id as deviceId, version
       FROM change_log
       WHERE user_id = ?
         AND (updated_at > ? OR (updated_at = ? AND id > ?))
       ORDER BY updated_at ASC, id ASC
       LIMIT 500`,
    )
      .bind(session.userId, cursor.ts, cursor.ts, cursor.opId)
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

    const last = changes[changes.length - 1];

    return json({
      cursor: last ? getCursor(last.timestamp, last.id) : url.searchParams.get('cursor') || '0:',
      changes,
      stats: { conflicts: 0 },
      schema,
    });
  },
};
