import test from 'node:test';
import assert from 'node:assert/strict';
import { applyLocalPendingOps, mergeSyncedStateWithLive, runSyncOnce } from '../src/lib/sync/engine';
import { AppStateData, SyncMeta, SyncOperation } from '../src/types';
import { builtInThemes } from '../src/themes/builtInThemes';
import { syncApi } from '../src/lib/sync/client';

const createState = (): AppStateData => ({
  version: 4,
  tasks: [
    {
      id: 'task-1',
      title: 'Keep me deleted',
      description: '',
      status: 'open',
      isStarred: false,
      projectId: null,
      area: 'Personal',
      dueDate: null,
      dayPart: null,
      parentId: null,
      collapsed: false,
      createdAt: 1,
      tags: [],
      updatedAt: 2,
      deletedAt: null,
      syncVersion: 7,
    },
  ],
  projects: [],
  notes: [],
  dayGoals: [],
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
    dailyGoalsEnabled: false,
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

test('applyLocalPendingOps preserves a task deletion queued during an in-flight sync', () => {
  const staleSyncResult = createState();
  const pendingDelete: SyncOperation = {
    id: 'op-delete-task-1',
    entity: 'task',
    action: 'delete',
    recordId: 'task-1',
    payload: { deletedAt: 3 },
    deviceId: 'device-a',
    timestamp: 3,
    baseVersion: 7,
  };

  const merged = applyLocalPendingOps(staleSyncResult, [pendingDelete]);

  assert.equal(merged.tasks.length, 0);
});

test('mergeSyncedStateWithLive preserves live local changes made during an in-flight sync', () => {
  const syncedState = createState();
  const liveState = {
    ...createState(),
    tasks: [{
      ...createState().tasks[0],
      title: 'Edited while syncing',
      updatedAt: 9,
    }],
    timer: {
      ...createState().timer,
      active: true,
    },
  };
  const pendingUpdate: SyncOperation = {
    id: 'op-update-task-1',
    entity: 'task',
    action: 'upsert',
    recordId: 'task-1',
    payload: liveState.tasks[0] as unknown as Record<string, unknown>,
    deviceId: 'device-a',
    timestamp: 9,
    baseVersion: 7,
  };

  const merged = mergeSyncedStateWithLive(syncedState, liveState, [pendingUpdate]);

  assert.equal(merged.tasks[0]?.title, 'Edited while syncing');
  assert.equal(merged.timer.active, true);
});

test('runSyncOnce clears accepted ops even when the follow-up pull fails', async () => {
  const originalPush = syncApi.push;
  const originalPull = syncApi.pull;

  const meta: SyncMeta = {
    mode: 'account',
    cloudLinked: true,
    deviceId: 'device-a',
    syncCursor: '1',
    lastSyncAt: null,
    pendingOps: [{
      id: 'op-update-task-1',
      entity: 'task',
      action: 'upsert',
      recordId: 'task-1',
      payload: createState().tasks[0] as unknown as Record<string, unknown>,
      deviceId: 'device-a',
      timestamp: 3,
      baseVersion: 7,
    }],
    localSchemaVersion: 4,
    schemaBlocked: false,
    settingsVersion: null,
    lastConflicts: [],
    lastSyncDiagnostics: null,
  };

  syncApi.push = async () => ({
    data: {
      accepted: 1,
      acceptedOpIds: ['op-update-task-1'],
      conflicts: [],
      cursor: '5',
    },
    requestId: 'req-push',
    retryCount: 0,
    status: 200,
  });
  syncApi.pull = async () => {
    throw new Error('network dropped');
  };

  try {
    const result = await runSyncOnce(createState(), meta);
    assert.equal(result.meta.pendingOps.length, 0);
    assert.equal(result.meta.syncCursor, '5');
    assert.match(result.error?.message || '', /network dropped/);
  } finally {
    syncApi.push = originalPush;
    syncApi.pull = originalPull;
  }
});
