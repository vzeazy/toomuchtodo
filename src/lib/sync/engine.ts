import { ApiError } from './http';
import { syncApi } from './client';
import { AppStateData, Project, SyncConflict, SyncDiagnostics, SyncMeta, SyncOperation, Task } from '../../types';

const applyChanges = (state: AppStateData, meta: SyncMeta, changes: SyncOperation[]) => {
  let nextState = { ...state };
  let nextMeta = { ...meta };

  for (const change of changes) {
    if (change.entity === 'task') {
      if (change.action === 'delete') {
        nextState = { ...nextState, tasks: nextState.tasks.filter((task) => task.id !== change.recordId) };
        continue;
      }

      const task = {
        ...(change.payload as Task),
        syncVersion: typeof change.version === 'number' ? change.version : ((change.payload as Task).syncVersion ?? null),
      };
      const exists = nextState.tasks.some((item) => item.id === change.recordId);
      nextState = {
        ...nextState,
        tasks: exists
          ? nextState.tasks.map((item) => (item.id === change.recordId ? ({ ...item, ...task, id: item.id }) : item))
          : [...nextState.tasks, task],
      };
      continue;
    }

    if (change.entity === 'project') {
      if (change.action === 'delete') {
        nextState = { ...nextState, projects: nextState.projects.filter((project) => project.id !== change.recordId) };
        continue;
      }

      const project = {
        ...(change.payload as Project),
        syncVersion: typeof change.version === 'number' ? change.version : ((change.payload as Project).syncVersion ?? null),
      };
      const exists = nextState.projects.some((item) => item.id === change.recordId);
      nextState = {
        ...nextState,
        projects: exists
          ? nextState.projects.map((item) => (item.id === change.recordId ? ({ ...item, ...project, id: item.id }) : item))
          : [...nextState.projects, project],
      };
      continue;
    }

    if (change.entity === 'settings' && change.action === 'upsert') {
      nextState = { ...nextState, settings: { ...nextState.settings, ...(change.payload as AppStateData['settings']) } };
      nextMeta = { ...nextMeta, settingsVersion: typeof change.version === 'number' ? change.version : nextMeta.settingsVersion };
    }
  }

  return { state: nextState, meta: nextMeta };
};

const toConflictChange = (conflict: SyncConflict): SyncOperation | null => {
  if (conflict.entity === 'settings') {
    if (!conflict.serverRecord) return null;
    return {
      id: `conflict-${conflict.opId}`,
      entity: 'settings',
      action: 'upsert',
      recordId: conflict.recordId,
      payload: conflict.serverRecord,
      deviceId: 'server',
      timestamp: Date.now(),
      version: conflict.serverVersion,
    };
  }

  if (!conflict.serverRecord || typeof conflict.serverRecord.deletedAt === 'number') {
    return {
      id: `conflict-${conflict.opId}`,
      entity: conflict.entity,
      action: 'delete',
      recordId: conflict.recordId,
      payload: { deletedAt: conflict.serverRecord?.deletedAt ?? Date.now() },
      deviceId: 'server',
      timestamp: Date.now(),
      version: conflict.serverVersion,
    };
  }

  return {
    id: `conflict-${conflict.opId}`,
    entity: conflict.entity,
    action: 'upsert',
    recordId: conflict.recordId,
    payload: conflict.serverRecord,
    deviceId: 'server',
    timestamp: Date.now(),
    version: conflict.serverVersion,
  };
};

const buildDiagnostics = (
  meta: SyncMeta,
  stage: SyncDiagnostics['stage'],
  status: SyncDiagnostics['status'],
  options: Partial<SyncDiagnostics> = {},
): SyncMeta => ({
  ...meta,
  lastSyncDiagnostics: {
    ...(meta.lastSyncDiagnostics || {
      stage: 'idle',
      status: 'idle',
      at: null,
      statusCode: null,
      serverCode: null,
      requestId: null,
      retryCount: 0,
      message: null,
      conflictCount: 0,
    }),
    stage,
    status,
    at: Date.now(),
    ...options,
  },
});

const applyBootstrapVersions = (ops: SyncOperation[], snapshot: AppStateData, settingsVersion: number | null) => {
  const taskVersions = new Map(snapshot.tasks.map((task) => [task.id, task.syncVersion ?? null]));
  const projectVersions = new Map(snapshot.projects.map((project) => [project.id, project.syncVersion ?? null]));

  return ops.map((op) => {
    if (op.entity === 'task') {
      return { ...op, baseVersion: taskVersions.get(op.recordId) ?? op.baseVersion ?? null };
    }
    if (op.entity === 'project') {
      return { ...op, baseVersion: projectVersions.get(op.recordId) ?? op.baseVersion ?? null };
    }
    if (op.entity === 'settings') {
      return { ...op, baseVersion: settingsVersion };
    }
    return op;
  });
};

const buildSchemaBlockedResult = (state: AppStateData, meta: SyncMeta, stage: SyncDiagnostics['stage'], message: string) => ({
  state,
  meta: buildDiagnostics({ ...meta, schemaBlocked: true }, stage, 'error', { message, serverCode: 'schema_blocked' }),
  error: new Error(message),
});

const toErrorMessage = (error: unknown) => {
  if (error instanceof Error) return error.message;
  return 'Sync failed';
};

export interface SyncRunResult {
  state: AppStateData;
  meta: SyncMeta;
  error: Error | null;
}

export const runSyncOnce = async (state: AppStateData, meta: SyncMeta): Promise<SyncRunResult> => {
  let nextMeta: SyncMeta = {
    ...meta,
    pendingOps: [...meta.pendingOps],
    lastConflicts: [],
  };
  let nextState = state;
  let acceptedOpIds: string[] = [];

  if (!nextMeta.cloudLinked || nextMeta.mode !== 'account') {
    return { state: nextState, meta: nextMeta, error: null };
  }

  if (!nextMeta.syncCursor) {
    try {
      const bootstrap = await syncApi.bootstrap();
      if (nextMeta.localSchemaVersion < bootstrap.data.schema.minSupportedClientSchema) {
        return buildSchemaBlockedResult(nextState, nextMeta, 'bootstrap', 'Client schema is too old for sync bootstrap.');
      }

      nextMeta = buildDiagnostics(
        {
          ...nextMeta,
          schemaBlocked: false,
          syncCursor: bootstrap.data.cursor,
          settingsVersion: bootstrap.data.settingsVersion,
        },
        'bootstrap',
        'success',
        {
          statusCode: bootstrap.status,
          requestId: bootstrap.requestId,
          retryCount: bootstrap.retryCount,
          message: null,
        },
      );

      if (!nextMeta.pendingOps.length) {
        nextState = {
          ...nextState,
          tasks: bootstrap.data.snapshot.tasks,
          projects: bootstrap.data.snapshot.projects,
          settings: { ...nextState.settings, ...bootstrap.data.snapshot.settings },
        };
      } else {
        nextMeta.pendingOps = applyBootstrapVersions(
          nextMeta.pendingOps,
          {
            ...nextState,
            tasks: bootstrap.data.snapshot.tasks,
            projects: bootstrap.data.snapshot.projects,
            settings: bootstrap.data.snapshot.settings,
          },
          bootstrap.data.settingsVersion,
        );
      }
    } catch (error) {
      const apiError = error instanceof ApiError ? error : null;
      nextMeta = buildDiagnostics(nextMeta, 'bootstrap', 'error', {
        statusCode: apiError?.status ?? null,
        serverCode: apiError?.serverCode ?? null,
        requestId: apiError?.requestId ?? null,
        retryCount: apiError?.retryCount ?? 0,
        message: toErrorMessage(error),
      });
      return { state: nextState, meta: nextMeta, error: error instanceof Error ? error : new Error('Sync bootstrap failed') };
    }
  }

  if (nextMeta.pendingOps.length) {
    try {
      const pushResult = await syncApi.push(nextMeta, nextMeta.pendingOps);
      acceptedOpIds = pushResult.data.acceptedOpIds;
      nextMeta = buildDiagnostics(
        {
          ...nextMeta,
          syncCursor: pushResult.data.cursor,
          lastConflicts: pushResult.data.conflicts,
        },
        'push',
        'success',
        {
          statusCode: pushResult.status,
          requestId: pushResult.requestId,
          retryCount: pushResult.retryCount,
          conflictCount: pushResult.data.conflicts.length,
          message: pushResult.data.conflicts.length ? 'Conflicts resolved in favor of the server record.' : null,
        },
      );

      if (pushResult.data.conflicts.length) {
        const conflictIds = new Set(pushResult.data.conflicts.map((conflict) => conflict.opId));
        nextMeta.pendingOps = nextMeta.pendingOps.filter((op) => !conflictIds.has(op.id));
        const conflictChanges = pushResult.data.conflicts
          .map(toConflictChange)
          .filter((value): value is SyncOperation => value !== null);
        const resolved = applyChanges(nextState, nextMeta, conflictChanges);
        nextState = resolved.state;
        nextMeta = resolved.meta;
      }
    } catch (error) {
      const apiError = error instanceof ApiError ? error : null;
      nextMeta = buildDiagnostics(nextMeta, 'push', 'error', {
        statusCode: apiError?.status ?? null,
        serverCode: apiError?.serverCode ?? null,
        requestId: apiError?.requestId ?? null,
        retryCount: apiError?.retryCount ?? 0,
        message: toErrorMessage(error),
      });
      return { state: nextState, meta: nextMeta, error: error instanceof Error ? error : new Error('Sync push failed') };
    }
  }

  try {
    const pull = await syncApi.pull(nextMeta);
    if (nextMeta.localSchemaVersion < pull.data.schema.minSupportedClientSchema) {
      return buildSchemaBlockedResult(nextState, nextMeta, 'pull', 'Client schema is too old for sync pull.');
    }

    nextMeta = {
      ...buildDiagnostics(
        {
          ...nextMeta,
          schemaBlocked: false,
          syncCursor: pull.data.cursor,
          lastSyncAt: Date.now(),
        },
        'pull',
        'success',
        {
          statusCode: pull.status,
          requestId: pull.requestId,
          retryCount: pull.retryCount,
          message: null,
          conflictCount: nextMeta.lastConflicts.length,
        },
      ),
      pendingOps: nextMeta.pendingOps.filter((op) => !acceptedOpIds.includes(op.id)),
    };

    if (pull.data.changes.length) {
      const resolved = applyChanges(nextState, nextMeta, pull.data.changes);
      nextState = resolved.state;
      nextMeta = resolved.meta;
    }

    return { state: nextState, meta: nextMeta, error: null };
  } catch (error) {
    const apiError = error instanceof ApiError ? error : null;
    nextMeta = buildDiagnostics(nextMeta, 'pull', 'error', {
      statusCode: apiError?.status ?? null,
      serverCode: apiError?.serverCode ?? null,
      requestId: apiError?.requestId ?? null,
      retryCount: apiError?.retryCount ?? 0,
      message: toErrorMessage(error),
      conflictCount: nextMeta.lastConflicts.length,
    });
    return { state: nextState, meta: nextMeta, error: error instanceof Error ? error : new Error('Sync pull failed') };
  }
};
