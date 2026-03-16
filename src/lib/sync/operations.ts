import { AppStateData, SyncMeta, SyncOperation } from '../../types';
import { areDayGoalsEqual, areNotesEqual, areProjectsEqual, areSettingsEqual, areTasksEqual } from './equality';

const uid = () => `op-${Math.random().toString(36).slice(2, 10)}`;

const withPayload = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object') return {};
  return value as Record<string, unknown>;
};

const getOpKey = (op: Pick<SyncOperation, 'entity' | 'recordId'>) => `${op.entity}:${op.recordId}`;

const pickBaseVersion = (existing: SyncOperation, incoming: SyncOperation) => (
  typeof existing.baseVersion === 'number'
    ? existing.baseVersion
    : (typeof incoming.baseVersion === 'number' ? incoming.baseVersion : null)
);

export const buildSyncOperations = (prev: AppStateData, next: AppStateData, meta: SyncMeta): SyncOperation[] => {
  if (!meta.cloudLinked || meta.mode !== 'account') return [];

  const timestamp = Date.now();
  const ops: SyncOperation[] = [];

  const prevTasks = new Map(prev.tasks.map((task) => [task.id, task]));
  const nextTasks = new Map(next.tasks.map((task) => [task.id, task]));
  for (const [id, nextTask] of nextTasks) {
    const prevTask = prevTasks.get(id);
    if (!prevTask || !areTasksEqual(prevTask, nextTask)) {
      ops.push({
        id: uid(),
        entity: 'task',
        action: 'upsert',
        recordId: id,
        payload: withPayload(nextTask),
        deviceId: meta.deviceId,
        timestamp,
        baseVersion: typeof prevTask?.syncVersion === 'number' ? prevTask.syncVersion : null,
      });
    }
  }
  for (const id of prevTasks.keys()) {
    const prevTask = prevTasks.get(id);
    if (!nextTasks.has(id)) {
      ops.push({
        id: uid(),
        entity: 'task',
        action: 'delete',
        recordId: id,
        payload: { deletedAt: timestamp },
        deviceId: meta.deviceId,
        timestamp,
        baseVersion: typeof prevTask?.syncVersion === 'number' ? prevTask.syncVersion : null,
      });
    }
  }

  const prevProjects = new Map(prev.projects.map((project) => [project.id, project]));
  const nextProjects = new Map(next.projects.map((project) => [project.id, project]));
  for (const [id, nextProject] of nextProjects) {
    const prevProject = prevProjects.get(id);
    if (!prevProject || !areProjectsEqual(prevProject, nextProject)) {
      ops.push({
        id: uid(),
        entity: 'project',
        action: 'upsert',
        recordId: id,
        payload: withPayload(nextProject),
        deviceId: meta.deviceId,
        timestamp,
        baseVersion: typeof prevProject?.syncVersion === 'number' ? prevProject.syncVersion : null,
      });
    }
  }
  for (const id of prevProjects.keys()) {
    const prevProject = prevProjects.get(id);
    if (!nextProjects.has(id)) {
      ops.push({
        id: uid(),
        entity: 'project',
        action: 'delete',
        recordId: id,
        payload: { deletedAt: timestamp },
        deviceId: meta.deviceId,
        timestamp,
        baseVersion: typeof prevProject?.syncVersion === 'number' ? prevProject.syncVersion : null,
      });
    }
  }

  const prevNotes = new Map(prev.notes.map((note) => [note.id, note]));
  const nextNotes = new Map(next.notes.map((note) => [note.id, note]));
  for (const [id, nextNote] of nextNotes) {
    const prevNote = prevNotes.get(id);
    if (!prevNote || !areNotesEqual(prevNote, nextNote)) {
      ops.push({
        id: uid(),
        entity: 'note',
        action: 'upsert',
        recordId: id,
        payload: withPayload(nextNote),
        deviceId: meta.deviceId,
        timestamp,
        baseVersion: typeof prevNote?.syncVersion === 'number' ? prevNote.syncVersion : null,
      });
    }
  }
  for (const id of prevNotes.keys()) {
    const prevNote = prevNotes.get(id);
    if (!nextNotes.has(id)) {
      ops.push({
        id: uid(),
        entity: 'note',
        action: 'delete',
        recordId: id,
        payload: { deletedAt: timestamp },
        deviceId: meta.deviceId,
        timestamp,
        baseVersion: typeof prevNote?.syncVersion === 'number' ? prevNote.syncVersion : null,
      });
    }
  }

  const prevDayGoals = new Map(prev.dayGoals.map((goal) => [goal.id, goal]));
  const nextDayGoals = new Map(next.dayGoals.map((goal) => [goal.id, goal]));
  for (const [id, nextDayGoal] of nextDayGoals) {
    const prevDayGoal = prevDayGoals.get(id);
    if (!prevDayGoal || !areDayGoalsEqual(prevDayGoal, nextDayGoal)) {
      ops.push({
        id: uid(),
        entity: 'dayGoal',
        action: 'upsert',
        recordId: id,
        payload: withPayload(nextDayGoal),
        deviceId: meta.deviceId,
        timestamp,
        baseVersion: typeof prevDayGoal?.syncVersion === 'number' ? prevDayGoal.syncVersion : null,
      });
    }
  }
  for (const id of prevDayGoals.keys()) {
    const prevDayGoal = prevDayGoals.get(id);
    if (!nextDayGoals.has(id)) {
      ops.push({
        id: uid(),
        entity: 'dayGoal',
        action: 'delete',
        recordId: id,
        payload: { deletedAt: timestamp },
        deviceId: meta.deviceId,
        timestamp,
        baseVersion: typeof prevDayGoal?.syncVersion === 'number' ? prevDayGoal.syncVersion : null,
      });
    }
  }

  if (!areSettingsEqual(prev.settings, next.settings)) {
    ops.push({
      id: uid(),
      entity: 'settings',
      action: 'upsert',
      recordId: 'settings',
      payload: withPayload(next.settings),
      deviceId: meta.deviceId,
      timestamp,
      baseVersion: meta.settingsVersion,
    });
  }

  return ops;
};

export const compactSyncOperations = (ops: SyncOperation[]): SyncOperation[] => {
  if (ops.length < 2) return ops;

  const compacted = [...ops];
  const indexByKey = new Map<string, number>();

  for (let index = 0; index < compacted.length; index += 1) {
    const op = compacted[index];
    const key = getOpKey(op);
    const existingIndex = indexByKey.get(key);

    if (existingIndex === undefined) {
      indexByKey.set(key, index);
      continue;
    }

    const existing = compacted[existingIndex];
    compacted[existingIndex] = {
      ...op,
      baseVersion: pickBaseVersion(existing, op),
    };
    compacted.splice(index, 1);
    index -= 1;

    for (const [knownKey, knownIndex] of indexByKey.entries()) {
      if (knownIndex > index) {
        indexByKey.set(knownKey, knownIndex - 1);
      }
    }
  }

  return compacted;
};

export const appendPendingOps = (meta: SyncMeta, ops: SyncOperation[]): SyncMeta => {
  if (!ops.length) return meta;
  return {
    ...meta,
    pendingOps: compactSyncOperations([...meta.pendingOps, ...ops]),
  };
};
