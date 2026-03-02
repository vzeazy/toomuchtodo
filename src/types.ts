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

export interface AppStateData {
  version: number;
  tasks: Task[];
  projects: Project[];
  settings: AppSettings;
  themes: ThemeDefinition[];
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
}

export interface TaskListExchange {
  schema: 'too-much-to-do.task-list';
  version: number;
  exportedAt: string;
  scope: TaskListScope;
  projects: TaskListExchangeProject[];
  tasks: TaskListExchangeTask[];
}
