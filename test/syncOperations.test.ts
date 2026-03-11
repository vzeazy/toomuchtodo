import test from 'node:test';
import assert from 'node:assert/strict';
import { appendPendingOps, buildSyncOperations } from '../src/lib/sync/operations';
import { AppStateData, SyncMeta } from '../src/types';
import { builtInThemes } from '../src/themes/builtInThemes';

const createState = (): AppStateData => ({
  version: 3,
  tasks: [],
  projects: [],
  notes: [],
  settings: {
    activeThemeId: builtInThemes[0].id,
    plannerWidthMode: 'container',
    taskListMode: 'list',
    notesListPreview: 'line1',
    notesViewLayout: 'list',
    showCompletedTasks: true,
    hideEmptyProjectsInPlanner: false,
    compactEmptyDaysInPlanner: false,
    startPlannerOnToday: false,
    groupDayViewByPart: false,
  },
  themes: builtInThemes,
  timer: {
    active: false,
    paused: false,
    duration: 1800,
    remaining: 1800,
    linkedTaskId: null,
    sessionTitle: null,
    lastTick: null,
    finished: false,
    minimized: false,
  },
});

const createMeta = (): SyncMeta => ({
  mode: 'account',
  cloudLinked: true,
  deviceId: 'device-a',
  syncCursor: '1',
  lastSyncAt: null,
  pendingOps: [],
  localSchemaVersion: 3,
  schemaBlocked: false,
  settingsVersion: null,
  lastConflicts: [],
  lastSyncDiagnostics: null,
});

test('appendPendingOps compacts repeated offline edits for the same record', () => {
  const syncedTask = {
    id: 'task-1',
    title: 'Original title',
    description: '',
    status: 'open' as const,
    isStarred: false,
    projectId: null,
    area: 'Personal',
    dueDate: null,
    dayPart: null,
    parentId: null,
    collapsed: false,
    createdAt: 1,
    tags: [],
    updatedAt: 1,
    deletedAt: null,
    syncVersion: 4,
  };
  const initial = { ...createState(), tasks: [syncedTask] };
  const firstEdit = { ...syncedTask, title: 'First title', updatedAt: 2 };
  const secondEdit = { ...syncedTask, title: 'Final title', updatedAt: 3 };
  const first = buildSyncOperations(initial, { ...initial, tasks: [firstEdit] }, createMeta());
  const second = buildSyncOperations(
    { ...initial, tasks: [firstEdit] },
    { ...initial, tasks: [secondEdit] },
    createMeta(),
  );

  const mergedMeta = appendPendingOps(appendPendingOps(createMeta(), first), second);

  assert.equal(mergedMeta.pendingOps.length, 1);
  assert.equal(mergedMeta.pendingOps[0]?.recordId, 'task-1');
  assert.equal(mergedMeta.pendingOps[0]?.baseVersion, 4);
  assert.equal(mergedMeta.pendingOps[0]?.payload.title, 'Final title');
});

test('buildSyncOperations ignores object key order differences', () => {
  const taskWithOneOrder = {
    id: 'task-1',
    title: 'Stable title',
    description: '',
    status: 'open' as const,
    isStarred: false,
    projectId: null,
    area: 'Personal',
    dueDate: null,
    dayPart: null,
    parentId: null,
    collapsed: false,
    createdAt: 1,
    tags: ['one'],
    updatedAt: 2,
    deletedAt: null,
    syncVersion: 7,
  };
  const taskWithDifferentOrder = {
    status: 'open' as const,
    description: '',
    id: 'task-1',
    title: 'Stable title',
    isStarred: false,
    area: 'Personal',
    projectId: null,
    dueDate: null,
    dayPart: null,
    parentId: null,
    collapsed: false,
    createdAt: 1,
    tags: ['one'],
    updatedAt: 2,
    deletedAt: null,
    syncVersion: 9,
  };

  const prev = { ...createState(), tasks: [taskWithOneOrder] };
  const next = { ...createState(), tasks: [taskWithDifferentOrder] };

  assert.deepEqual(buildSyncOperations(prev, next, createMeta()), []);
});
