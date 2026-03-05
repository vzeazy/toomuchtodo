import { AppStateData, SyncMeta } from '../../types';
import { syncApi } from './client';

const applyChanges = (state: AppStateData, changes: SyncMeta['pendingOps']): AppStateData => {
  let next = { ...state };
  for (const change of changes) {
    if (change.entity === 'task') {
      if (change.action === 'delete') {
        next = { ...next, tasks: next.tasks.filter((task) => task.id !== change.recordId) };
        continue;
      }
      const task = change.payload as AppStateData['tasks'][number];
      const exists = next.tasks.some((item) => item.id === change.recordId);
      next = {
        ...next,
        tasks: exists
          ? next.tasks.map((item) => (item.id === change.recordId ? ({ ...item, ...task, id: item.id }) : item))
          : [...next.tasks, task],
      };
      continue;
    }

    if (change.entity === 'project') {
      if (change.action === 'delete') {
        next = { ...next, projects: next.projects.filter((project) => project.id !== change.recordId) };
        continue;
      }
      const project = change.payload as AppStateData['projects'][number];
      const exists = next.projects.some((item) => item.id === change.recordId);
      next = {
        ...next,
        projects: exists
          ? next.projects.map((item) => (item.id === change.recordId ? ({ ...item, ...project, id: item.id }) : item))
          : [...next.projects, project],
      };
      continue;
    }

    if (change.entity === 'settings' && change.action === 'upsert') {
      next = { ...next, settings: { ...next.settings, ...(change.payload as AppStateData['settings']) } };
    }
  }

  return next;
};

export const runSyncOnce = async (state: AppStateData, meta: SyncMeta) => {
  const nextMeta: SyncMeta = { ...meta };
  let nextState = state;

  if (!nextMeta.cloudLinked || nextMeta.mode !== 'account') {
    return { state: nextState, meta: nextMeta };
  }

  if (!nextMeta.syncCursor) {
    const bootstrap = await syncApi.bootstrap();
    if (nextMeta.localSchemaVersion < bootstrap.schema.minSupportedClientSchema) {
      return {
        state: nextState,
        meta: { ...nextMeta, schemaBlocked: true },
      };
    }
    nextMeta.schemaBlocked = false;
    nextMeta.syncCursor = bootstrap.cursor;

    // first link: local-wins-first-link by default (queue is pushed right after bootstrap)
    if (!nextMeta.pendingOps.length) {
      nextState = {
        ...nextState,
        tasks: bootstrap.snapshot.tasks,
        projects: bootstrap.snapshot.projects,
        settings: { ...nextState.settings, ...bootstrap.snapshot.settings },
      };
    }
  }

  if (nextMeta.pendingOps.length) {
    const pushResult = await syncApi.push(nextMeta, nextMeta.pendingOps);
    nextMeta.syncCursor = pushResult.cursor;
    nextMeta.pendingOps = [];
  }

  const pull = await syncApi.pull(nextMeta);
  if (nextMeta.localSchemaVersion < pull.schema.minSupportedClientSchema) {
    return {
      state: nextState,
      meta: { ...nextMeta, schemaBlocked: true },
    };
  }

  nextMeta.schemaBlocked = false;
  nextMeta.syncCursor = pull.cursor;
  nextMeta.lastSyncAt = Date.now();

  if (pull.changes.length) {
    nextState = applyChanges(nextState, pull.changes);
  }

  return { state: nextState, meta: nextMeta };
};
