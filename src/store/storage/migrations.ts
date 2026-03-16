import { AppStateData, AppSettings, DayGoal, SyncDiagnostics, SyncMeta, ThemeDefinition, TimerState } from '../../types';
import { builtInThemes } from '../../themes/builtInThemes';

export const APP_SCHEMA_VERSION = 4;

const INITIAL_SETTINGS: AppSettings = {
  activeThemeId: builtInThemes[0].id,
  plannerWidthMode: 'container',
  taskListMode: 'list',
  notesListPreview: 'line1',
  notesViewLayout: 'list',
  contextualNotesEnabled: true,
  contextualNotesOrder: {},
  showCompletedTasks: true,
  hideEmptyProjectsInPlanner: false,
  compactEmptyDaysInPlanner: false,
  startPlannerOnToday: false,
  groupDayViewByPart: false,
  dailyGoalsEnabled: false,
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
  notes: [],
  dayGoals: [],
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

const migrateV2toV3 = (state: AppStateData): AppStateData => ({
  ...state,
  version: APP_SCHEMA_VERSION,
  notes: Array.isArray(state.notes) ? state.notes : [],
});

const normalizeDayGoal = (goal: Partial<DayGoal>): DayGoal => {
  const createdAt = typeof goal.createdAt === 'number' ? goal.createdAt : Date.now();
  return {
    id: typeof goal.id === 'string' ? goal.id : `goal-${Math.random().toString(36).slice(2, 10)}`,
    date: typeof goal.date === 'string' ? goal.date : '',
    title: typeof goal.title === 'string' && goal.title.trim() ? goal.title : 'Untitled goal',
    linkedTaskId: typeof goal.linkedTaskId === 'string' ? goal.linkedTaskId : null,
    position: typeof goal.position === 'number' ? goal.position : 0,
    completedAt: typeof goal.completedAt === 'number' ? goal.completedAt : null,
    archivedAt: typeof goal.archivedAt === 'number' ? goal.archivedAt : null,
    createdAt,
    updatedAt: typeof goal.updatedAt === 'number' ? goal.updatedAt : createdAt,
    deletedAt: typeof goal.deletedAt === 'number' ? goal.deletedAt : null,
    syncVersion: typeof goal.syncVersion === 'number' ? goal.syncVersion : null,
  };
};

const migrateV3toV4 = (state: AppStateData): AppStateData => ({
  ...state,
  version: APP_SCHEMA_VERSION,
  dayGoals: Array.isArray((state as AppStateData & { dayGoals?: DayGoal[] }).dayGoals)
    ? (state as AppStateData & { dayGoals?: DayGoal[] }).dayGoals!.map(normalizeDayGoal)
    : [],
  settings: {
    ...INITIAL_SETTINGS,
    ...(state.settings || {}),
    dailyGoalsEnabled: state.settings?.dailyGoalsEnabled ?? INITIAL_SETTINGS.dailyGoalsEnabled,
  },
});

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

  if (currentVersion < 3) {
    state = migrateV2toV3(state);
    currentVersion = 3;
  }

  if (currentVersion < 4) {
    state = migrateV3toV4(state);
    currentVersion = 4;
  }

  return {
    localSchemaVersion: APP_SCHEMA_VERSION,
    state: {
      ...state,
      version: APP_SCHEMA_VERSION,
    },
  };
};
