import { Env, SyncOperation, UserSession } from '../types';
import { id, isAllowedOrigin, isMutation, json, now, parseJson, rateLimit } from '../lib';
import { getSchemaMeta } from '../db/schema';

interface PushPayload {
  deviceId?: string;
  cursor?: string | null;
  ops?: SyncOperation[];
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

const registerDevice = async (env: Env, userId: string, deviceId: string) => {
  const ts = now();
  await env.DB.prepare(
    'INSERT INTO devices (id, user_id, created_at, last_seen_at) VALUES (?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET last_seen_at = excluded.last_seen_at',
  )
    .bind(deviceId, userId, ts, ts)
    .run();
};

const pushOne = async (env: Env, userId: string, op: SyncOperation) => {
  const ts = now();
  if (op.entity === 'task') {
    if (op.action === 'delete') {
      await env.DB.prepare('UPDATE tasks SET deleted_at = ?, updated_at = ?, version = version + 1 WHERE id = ? AND user_id = ?')
        .bind(op.timestamp || ts, op.timestamp || ts, op.recordId, userId)
        .run();
    } else {
      const task = toTaskRow(op.payload || {});
      await env.DB.prepare(
        `INSERT INTO tasks (id, user_id, title, description, status, is_starred, project_id, area, due_date, day_part, parent_id, collapsed, created_at, tags, updated_at, deleted_at, version)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
         ON CONFLICT(id) DO UPDATE SET
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
         version=tasks.version+1`,
      )
        .bind(task.id || op.recordId, userId, task.title, task.description, task.status, task.isStarred, task.projectId, task.area, task.dueDate, task.dayPart, task.parentId, task.collapsed, task.createdAt, task.tags, task.updatedAt, task.deletedAt)
        .run();
    }
  }

  if (op.entity === 'project') {
    if (op.action === 'delete') {
      await env.DB.prepare('UPDATE projects SET deleted_at = ?, updated_at = ?, version = version + 1 WHERE id = ? AND user_id = ?')
        .bind(op.timestamp || ts, op.timestamp || ts, op.recordId, userId)
        .run();
    } else {
      const project = toProjectRow(op.payload || {});
      await env.DB.prepare(
        `INSERT INTO projects (id, user_id, name, color, parent_id, updated_at, deleted_at, version)
         VALUES (?, ?, ?, ?, ?, ?, ?, 1)
         ON CONFLICT(id) DO UPDATE SET
         name=excluded.name,
         color=excluded.color,
         parent_id=excluded.parent_id,
         updated_at=excluded.updated_at,
         deleted_at=excluded.deleted_at,
         version=projects.version+1`,
      )
        .bind(project.id || op.recordId, userId, project.name, project.color, project.parentId, project.updatedAt, project.deletedAt)
        .run();
    }
  }

  if (op.entity === 'settings' && op.action === 'upsert') {
    await env.DB.prepare(
      `INSERT INTO settings (id, user_id, payload, updated_at, deleted_at, version)
       VALUES (?, ?, ?, ?, NULL, 1)
       ON CONFLICT(id) DO UPDATE SET
       payload=excluded.payload,
       updated_at=excluded.updated_at,
       version=settings.version+1`,
    )
      .bind('settings', userId, JSON.stringify(op.payload || {}), op.timestamp || ts)
      .run();
  }

  await env.DB.prepare(
    'INSERT INTO change_log (id, user_id, device_id, entity, record_id, action, payload, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
  )
    .bind(op.id || id('op'), userId, op.deviceId || 'unknown', op.entity, op.recordId, op.action, JSON.stringify(op.payload || {}), op.timestamp || ts)
    .run();
};

const readSnapshot = async (env: Env, userId: string) => {
  const [tasksRes, projectsRes, settingsRow] = await Promise.all([
    env.DB.prepare('SELECT * FROM tasks WHERE user_id = ? AND deleted_at IS NULL').bind(userId).all(),
    env.DB.prepare('SELECT * FROM projects WHERE user_id = ? AND deleted_at IS NULL').bind(userId).all(),
    env.DB.prepare('SELECT payload FROM settings WHERE user_id = ? AND id = ? AND deleted_at IS NULL').bind(userId, 'settings').first<{ payload: string }>(),
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
  }));

  const projects = (projectsRes.results || []).map((row: any) => ({
    id: row.id,
    name: row.name,
    color: row.color || undefined,
    parentId: row.parent_id,
    updatedAt: Number(row.updated_at),
    deletedAt: row.deleted_at ? Number(row.deleted_at) : null,
  }));

  const settings = settingsRow ? JSON.parse(settingsRow.payload) : {};

  return { tasks, projects, settings };
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
    for (const op of ops) {
      await pushOne(env, session.userId, { ...op, deviceId });
    }

    const latest = await env.DB.prepare('SELECT id, updated_at as updatedAt FROM change_log WHERE user_id = ? ORDER BY updated_at DESC, id DESC LIMIT 1')
      .bind(session.userId)
      .first<{ id: string; updatedAt: number }>();

    return json({
      accepted: ops.length,
      conflicts: 0,
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
      `SELECT id, entity, record_id as recordId, action, payload, updated_at as updatedAt, device_id as deviceId
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
