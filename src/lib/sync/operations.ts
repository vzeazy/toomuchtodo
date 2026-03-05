import { AppStateData, SyncMeta, SyncOperation } from '../../types';

const uid = () => `op-${Math.random().toString(36).slice(2, 10)}`;

const withPayload = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object') return {};
  return value as Record<string, unknown>;
};

export const buildSyncOperations = (prev: AppStateData, next: AppStateData, meta: SyncMeta): SyncOperation[] => {
  if (!meta.cloudLinked || meta.mode !== 'account') return [];

  const timestamp = Date.now();
  const ops: SyncOperation[] = [];

  const prevTasks = new Map(prev.tasks.map((task) => [task.id, task]));
  const nextTasks = new Map(next.tasks.map((task) => [task.id, task]));
  for (const [id, nextTask] of nextTasks) {
    const prevTask = prevTasks.get(id);
    if (!prevTask || JSON.stringify(prevTask) !== JSON.stringify(nextTask)) {
      ops.push({
        id: uid(),
        entity: 'task',
        action: 'upsert',
        recordId: id,
        payload: withPayload(nextTask),
        deviceId: meta.deviceId,
        timestamp,
      });
    }
  }
  for (const id of prevTasks.keys()) {
    if (!nextTasks.has(id)) {
      ops.push({
        id: uid(),
        entity: 'task',
        action: 'delete',
        recordId: id,
        payload: { deletedAt: timestamp },
        deviceId: meta.deviceId,
        timestamp,
      });
    }
  }

  const prevProjects = new Map(prev.projects.map((project) => [project.id, project]));
  const nextProjects = new Map(next.projects.map((project) => [project.id, project]));
  for (const [id, nextProject] of nextProjects) {
    const prevProject = prevProjects.get(id);
    if (!prevProject || JSON.stringify(prevProject) !== JSON.stringify(nextProject)) {
      ops.push({
        id: uid(),
        entity: 'project',
        action: 'upsert',
        recordId: id,
        payload: withPayload(nextProject),
        deviceId: meta.deviceId,
        timestamp,
      });
    }
  }
  for (const id of prevProjects.keys()) {
    if (!nextProjects.has(id)) {
      ops.push({
        id: uid(),
        entity: 'project',
        action: 'delete',
        recordId: id,
        payload: { deletedAt: timestamp },
        deviceId: meta.deviceId,
        timestamp,
      });
    }
  }

  if (JSON.stringify(prev.settings) !== JSON.stringify(next.settings)) {
    ops.push({
      id: uid(),
      entity: 'settings',
      action: 'upsert',
      recordId: 'settings',
      payload: withPayload(next.settings),
      deviceId: meta.deviceId,
      timestamp,
    });
  }

  return ops;
};

export const appendPendingOps = (meta: SyncMeta, ops: SyncOperation[]): SyncMeta => {
  if (!ops.length) return meta;
  return {
    ...meta,
    pendingOps: [...meta.pendingOps, ...ops],
  };
};
