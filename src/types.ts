export type TaskStatus = 'inbox' | 'open' | 'next' | 'waiting' | 'scheduled' | 'someday' | 'completed' | 'deleted';

export type AppView = TaskStatus | 'focus' | 'today' | 'trash' | 'all' | 'planner' | 'day' | 'settings' | 'search';

export type PlannerWidthMode = 'container' | 'wide' | 'full';
export type TaskListMode = 'list' | 'outline';
export type DayPart = 'morning' | 'afternoon' | 'evening';

export interface Project {
  id: string;
  name: string;
  color?: string;
  parentId?: string | null;
  updatedAt: number;
  deletedAt: number | null;
  syncVersion?: number | null;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  isStarred: boolean;
  projectId: string | null;
  area: string;
  dueDate: string | null;
  dayPart: DayPart | null;
  parentId: string | null;
  collapsed: boolean;
  createdAt: number;
  tags: string[];
  updatedAt: number;
  deletedAt: number | null;
  syncVersion?: number | null;
}

export interface ThemeTokens {
  appBg: string;
  sidebarBg: string;
  panelBg: string;
  panelAltBg: string;
  elevatedBg: string;
  borderColor: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  accent: string;
  accentSoft: string;
  accentContrast: string;
  success: string;
  successSoft: string;
  danger: string;
  dangerSoft: string;
  focus: string;
  overlay: string;
}

export interface ThemeDefinition {
  id: string;
  name: string;
  description: string;
  mode: 'dark' | 'light';
  builtIn?: boolean;
  tokens: ThemeTokens;
}

export interface AppSettings {
  activeThemeId: string;
  plannerWidthMode: PlannerWidthMode;
  taskListMode: TaskListMode;
  showCompletedTasks: boolean;
  hideEmptyProjectsInPlanner: boolean;
  compactEmptyDaysInPlanner: boolean;
  startPlannerOnToday: boolean;
  groupDayViewByPart: boolean;
}

export interface TimerState {
  active: boolean;
  paused: boolean;
  duration: number; // in seconds
  remaining: number; // in seconds
  linkedTaskId: string | null;
  sessionTitle: string | null;
  lastTick: number | null; // timestamp of last tick when active
  finished: boolean;
  minimized: boolean;
}

export interface AppStateData {
  version: number;
  tasks: Task[];
  projects: Project[];
  settings: AppSettings;
  themes: ThemeDefinition[];
  timer: TimerState;
}

export interface SyncOperation {
  id: string;
  entity: 'task' | 'project' | 'settings';
  action: 'upsert' | 'delete';
  recordId: string;
  payload: Record<string, unknown>;
  deviceId: string;
  timestamp: number;
  baseVersion?: number | null;
  version?: number | null;
}

export interface SyncConflict {
  opId: string;
  entity: SyncOperation['entity'];
  action: SyncOperation['action'];
  recordId: string;
  reason: 'version_mismatch';
  clientVersion: number | null;
  serverVersion: number | null;
  serverRecord: Record<string, unknown> | null;
}

export interface SyncDiagnostics {
  stage: 'idle' | 'bootstrap' | 'push' | 'pull';
  status: 'idle' | 'syncing' | 'success' | 'error';
  at: number | null;
  statusCode: number | null;
  serverCode: string | null;
  requestId: string | null;
  retryCount: number;
  message: string | null;
  conflictCount: number;
}

export interface SyncMeta {
  mode: 'local' | 'account';
  cloudLinked: boolean;
  deviceId: string;
  syncCursor: string | null;
  lastSyncAt: number | null;
  pendingOps: SyncOperation[];
  localSchemaVersion: number;
  schemaBlocked: boolean;
  settingsVersion: number | null;
  lastConflicts: SyncConflict[];
  lastSyncDiagnostics: SyncDiagnostics | null;
}

export interface AppDataExport {
  version: number;
  exportedAt: string;
  app: 'too-much-to-do';
  data: AppStateData;
}

export type TaskListScope =
  | { type: 'inbox' }
  | { type: 'project'; projectId: string };

export type TaskListImportMode = 'append' | 'upsert' | 'replace-list';

export interface TaskListExchangeProject {
  id: string;
  name: string;
  parentId: string | null;
  color?: string;
}

export interface TaskListExchangeTask {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  isStarred: boolean;
  projectId: string | null;
  area: string;
  dueDate: string | null;
  dayPart: DayPart | null;
  parentId: string | null;
  collapsed: boolean;
  createdAt: number;
  tags: string[];
  updatedAt?: number;
  deletedAt?: number | null;
}

export interface TaskListExchange {
  schema: 'too-much-to-do.task-list';
  version: number;
  exportedAt: string;
  scope: TaskListScope;
  projects: TaskListExchangeProject[];
  tasks: TaskListExchangeTask[];
}
