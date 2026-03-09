import { AppStateData, SyncMeta } from '../../types';
import { createDefaultSyncMeta, PersistedEnvelope, runStateMigrations } from './migrations';
import { builtInThemes } from '../../themes/builtInThemes';

const STORAGE_KEY = 'too_much_to_do_state_v2';
const LEGACY_STORAGE_KEY = 'too_much_to_do_state_v1';
const LEGACY_TASKS_KEY = 'too_much_to_do_legacy_tasks';
const LEGACY_PROJECTS_KEY = 'too_much_to_do_legacy_projects';
const SYNC_META_KEY = 'too_much_to_do_sync_meta_v1';

const parseJson = <T>(raw: string | null): T | null => {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
};

const buildLegacyState = (): AppStateData | null => {
  const legacyV1 = parseJson<AppStateData>(localStorage.getItem(LEGACY_STORAGE_KEY));
  if (legacyV1) return legacyV1;

  const legacyTasks = parseJson<AppStateData['tasks']>(localStorage.getItem(LEGACY_TASKS_KEY));
  const legacyProjects = parseJson<AppStateData['projects']>(localStorage.getItem(LEGACY_PROJECTS_KEY));

  if (!legacyTasks && !legacyProjects) return null;

  return {
    version: 1,
    tasks: Array.isArray(legacyTasks) ? legacyTasks : [],
    projects: Array.isArray(legacyProjects) ? legacyProjects : [],
    settings: {
      activeThemeId: builtInThemes[0].id,
      plannerWidthMode: 'container',
      taskListMode: 'list',
      showCompletedTasks: true,
      hideEmptyProjectsInPlanner: false,
      compactEmptyDaysInPlanner: false,
      startPlannerOnToday: false,
      groupDayViewByPart: false,
    },
    themes: [],
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
  };
};

export interface StorageDriver {
  loadState(): AppStateData;
  saveState(state: AppStateData): void;
  runMigrations(state: AppStateData): AppStateData;
  getSyncMeta(): SyncMeta;
  setSyncMeta(meta: SyncMeta): void;
}

export class LocalOnlyDriver implements StorageDriver {
  loadState(): AppStateData {
    const rawCurrent = parseJson<PersistedEnvelope>(localStorage.getItem(STORAGE_KEY));
    const legacyState = rawCurrent ? null : buildLegacyState();
    const migrated = runStateMigrations(rawCurrent || legacyState);
    this.saveEnvelope(migrated);
    return migrated.state;
  }

  saveState(state: AppStateData): void {
    const migrated = runStateMigrations(state);
    this.saveEnvelope(migrated);
  }

  runMigrations(state: AppStateData): AppStateData {
    return runStateMigrations(state).state;
  }

  getSyncMeta(): SyncMeta {
    const raw = parseJson<SyncMeta>(localStorage.getItem(SYNC_META_KEY));
    if (!raw) {
      const defaults = createDefaultSyncMeta();
      this.setSyncMeta(defaults);
      return defaults;
    }

    const normalized: SyncMeta = {
      ...createDefaultSyncMeta(),
      ...raw,
      pendingOps: Array.isArray(raw.pendingOps) ? raw.pendingOps : [],
      lastConflicts: Array.isArray(raw.lastConflicts) ? raw.lastConflicts : [],
      lastSyncDiagnostics: raw.lastSyncDiagnostics
        ? { ...createDefaultSyncMeta().lastSyncDiagnostics, ...raw.lastSyncDiagnostics }
        : createDefaultSyncMeta().lastSyncDiagnostics,
    };

    if (!normalized.deviceId) normalized.deviceId = createDefaultSyncMeta().deviceId;
    this.setSyncMeta(normalized);
    return normalized;
  }

  setSyncMeta(meta: SyncMeta): void {
    localStorage.setItem(SYNC_META_KEY, JSON.stringify(meta));
  }

  private saveEnvelope(envelope: PersistedEnvelope): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(envelope));
  }
}
