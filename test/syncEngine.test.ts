import test from 'node:test';
import assert from 'node:assert/strict';
import { applyLocalPendingOps } from '../src/lib/sync/engine';
import { AppStateData, SyncOperation } from '../src/types';
import { builtInThemes } from '../src/themes/builtInThemes';

const createState = (): AppStateData => ({
  version: 3,
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
