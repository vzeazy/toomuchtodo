import { AppStateData, AppSettings, SyncDiagnostics, SyncMeta, ThemeDefinition, TimerState } from '../../types';
import { builtInThemes } from '../../themes/builtInThemes';

export const APP_SCHEMA_VERSION = 2;

const INITIAL_SETTINGS: AppSettings = {
  activeThemeId: builtInThemes[0].id,
  plannerWidthMode: 'container',
  taskListMode: 'list',
  showCompletedTasks: true,
  hideEmptyProjectsInPlanner: false,
  compactEmptyDaysInPlanner: false,
  startPlannerOnToday: false,
  groupDayViewByPart: false,
};

const INITIAL_TIMER_STATE: TimerState = {
  active: false,
  paused: false,
  duration: 1800,
  remaining: 1800,
  linkedTaskId: null,
  sessionTitle: null,
  lastTick: null,
  finished: false,
  minimized: false,
};

const dedupeThemes = (themes: ThemeDefinition[]) => {
  const seen = new Map<string, ThemeDefinition>();
  for (const theme of themes) seen.set(theme.id, theme);
  return Array.from(seen.values());
};

const createDefaultSyncDiagnostics = (): SyncDiagnostics => ({
  stage: 'idle',
  status: 'idle',
  at: null,
  statusCode: null,
  serverCode: null,
  requestId: null,
  retryCount: 0,
  message: null,
  conflictCount: 0,
});

export interface PersistedEnvelope {
  localSchemaVersion: number;
  state: AppStateData;
}

const uid = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 10)}`;

const createDefaultState = (): AppStateData => ({
  version: APP_SCHEMA_VERSION,
  tasks: [],
  projects: [],
  settings: INITIAL_SETTINGS,
  themes: builtInThemes,
  timer: INITIAL_TIMER_STATE,
});

export const createDefaultSyncMeta = (): SyncMeta => ({
  mode: 'local',
  cloudLinked: false,
  deviceId: uid('device'),
  syncCursor: null,
  lastSyncAt: null,
  pendingOps: [],
  localSchemaVersion: APP_SCHEMA_VERSION,
  schemaBlocked: false,
  settingsVersion: null,
  lastConflicts: [],
  lastSyncDiagnostics: createDefaultSyncDiagnostics(),
});

const migrateV1toV2 = (state: AppStateData): AppStateData => {
  const now = Date.now();
  return {
    ...state,
    version: APP_SCHEMA_VERSION,
    tasks: state.tasks.map((task) => ({
      ...task,
      updatedAt: typeof task.updatedAt === 'number' ? task.updatedAt : (typeof task.createdAt === 'number' ? task.createdAt : now),
      deletedAt: typeof task.deletedAt === 'number' ? task.deletedAt : null,
      syncVersion: typeof task.syncVersion === 'number' ? task.syncVersion : null,
    })),
    projects: state.projects.map((project) => ({
      ...project,
      updatedAt: typeof project.updatedAt === 'number' ? project.updatedAt : now,
      deletedAt: typeof project.deletedAt === 'number' ? project.deletedAt : null,
      syncVersion: typeof project.syncVersion === 'number' ? project.syncVersion : null,
    })),
    settings: {
      ...INITIAL_SETTINGS,
      ...(state.settings || {}),
    },
    themes: dedupeThemes([...(Array.isArray(state.themes) ? state.themes : []), ...builtInThemes]),
    timer: state.timer || INITIAL_TIMER_STATE,
  };
};

export const createDefaultSyncDiagnosticsState = createDefaultSyncDiagnostics;

export const runStateMigrations = (input: PersistedEnvelope | AppStateData | null | undefined): PersistedEnvelope => {
  if (!input) {
    return { localSchemaVersion: APP_SCHEMA_VERSION, state: createDefaultState() };
  }

  const envelope = 'state' in input
    ? input
    : { localSchemaVersion: typeof input.version === 'number' ? input.version : 1, state: input };

  let currentVersion = envelope.localSchemaVersion || 1;
  let state = envelope.state || createDefaultState();

  if (currentVersion < 2) {
    state = migrateV1toV2(state);
    currentVersion = 2;
  }

  return {
    localSchemaVersion: APP_SCHEMA_VERSION,
    state: {
      ...state,
      version: APP_SCHEMA_VERSION,
    },
  };
};
