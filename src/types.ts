export type TaskStatus = 'inbox' | 'next' | 'waiting' | 'scheduled' | 'someday' | 'completed' | 'deleted';

export type AppView = TaskStatus | 'focus' | 'today' | 'trash' | 'all' | 'planner' | 'day' | 'settings' | 'search';

export type PlannerWidthMode = 'container' | 'wide' | 'full';
export type TaskListMode = 'list' | 'outline';

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
