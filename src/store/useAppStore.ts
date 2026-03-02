import { useCallback, useEffect, useMemo, useState } from 'react';
import { moveTaskSubtree, moveTaskSubtreePreserveParent, updateTaskParent } from '../features/tasks/taskTree';
import { builtInThemes } from '../themes/builtInThemes';
import {
  AppDataExport,
  AppSettings,
  AppStateData,
  PlannerWidthMode,
  Project,
  Task,
  TaskListExchange,
  TaskListImportMode,
  TaskListMode,
  TaskStatus,
  ThemeDefinition,
} from '../types';

const STORAGE_KEY = 'too_much_to_do_state_v1';
const LEGACY_TASKS_KEY = 'nirvana_tasks';
const LEGACY_PROJECTS_KEY = 'nirvana_projects';
const CURRENT_VERSION = 1;

const INITIAL_PROJECTS: Project[] = [
  { id: 'proj-1', name: 'WRD Updates', parentId: null },
  { id: 'proj-2', name: 'Advocacy program for BIOM8', parentId: null },
  { id: 'proj-3', name: 'Habit sets website', parentId: null },
  { id: 'proj-4', name: 'GRT Europe', parentId: null },
  { id: 'proj-5', name: 'GRT Website Upgrade', parentId: null },
];
const LEGACY_BOOTSTRAP_PROJECT_COLORS = new Map([
  ['proj-1', '#5ea1ff'],
  ['proj-2', '#71d7c7'],
  ['proj-3', '#f2b56b'],
  ['proj-4', '#c792ea'],
  ['proj-5', '#ef7d7d'],
]);

const INITIAL_TASKS: Task[] = [
  {
    id: '1',
    title: 'Sales tax submission to CRA',
    description: '',
    status: 'next',
    isStarred: true,
    projectId: null,
    area: 'Work',
    dueDate: null,
    parentId: null,
    collapsed: false,
    createdAt: Date.now(),
    tags: ['admin'],
  },
  {
    id: '2',
    title: 'Double check DHL Express rates',
    description: '',
    status: 'next',
    isStarred: true,
    projectId: null,
    area: 'Work',
    dueDate: null,
    parentId: null,
    collapsed: false,
    createdAt: Date.now(),
    tags: ['shipping'],
  },
  {
    id: '3',
    title: 'Spider 4 instructional video',
    description: '## Outline\n- script\n- edit pass\n- export',
    status: 'scheduled',
    isStarred: true,
    projectId: 'proj-1',
    area: 'Work',
    dueDate: new Date().toISOString().slice(0, 10),
    parentId: null,
    collapsed: false,
    createdAt: Date.now(),
    tags: ['content'],
  },
];

const INITIAL_SETTINGS: AppSettings = {
  activeThemeId: builtInThemes[0].id,
  plannerWidthMode: 'container',
  taskListMode: 'list',
  showCompletedTasks: true,
};

const uid = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 10)}`;

const normalizeTask = (task: Partial<Task>): Task => ({
  id: typeof task.id === 'string' ? task.id : uid('task'),
  title: typeof task.title === 'string' ? task.title : 'Untitled task',
  description: typeof task.description === 'string' ? task.description : '',
  status: (task.status as TaskStatus) || 'inbox',
  isStarred: Boolean(task.isStarred),
  projectId: typeof task.projectId === 'string' ? task.projectId : null,
  area: typeof task.area === 'string' ? task.area : 'Personal',
  dueDate: typeof task.dueDate === 'string' ? task.dueDate : null,
  parentId: typeof task.parentId === 'string' ? task.parentId : null,
  collapsed: typeof task.collapsed === 'boolean' ? task.collapsed : false,
  createdAt: typeof task.createdAt === 'number' ? task.createdAt : Date.now(),
  tags: Array.isArray(task.tags) ? task.tags.filter((tag): tag is string => typeof tag === 'string') : [],
});

const dedupeThemes = (themes: ThemeDefinition[]) => {
  const seen = new Map<string, ThemeDefinition>();
  for (const theme of themes) seen.set(theme.id, theme);
  return Array.from(seen.values());
};

const normalizeProject = (project: Partial<Project>): Project => ({
  id: typeof project.id === 'string' ? project.id : uid('proj'),
  name: typeof project.name === 'string' ? project.name : 'Untitled project',
  color: typeof project.id === 'string' && LEGACY_BOOTSTRAP_PROJECT_COLORS.get(project.id) === project.color
    ? undefined
    : typeof project.color === 'string' && project.color.trim() ? project.color : undefined,
  parentId: typeof project.parentId === 'string' ? project.parentId : null,
});

const getInitialState = (): AppStateData => {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    try {
      const parsed = JSON.parse(stored) as Partial<AppStateData>;
      return {
        version: CURRENT_VERSION,
        tasks: Array.isArray(parsed.tasks) ? parsed.tasks.map(normalizeTask) : INITIAL_TASKS,
        projects: Array.isArray(parsed.projects) ? parsed.projects.map(normalizeProject) : INITIAL_PROJECTS,
        settings: {
          activeThemeId: parsed.settings?.activeThemeId || INITIAL_SETTINGS.activeThemeId,
          plannerWidthMode: (parsed.settings?.plannerWidthMode as PlannerWidthMode) || INITIAL_SETTINGS.plannerWidthMode,
          taskListMode: (parsed.settings?.taskListMode as TaskListMode) || INITIAL_SETTINGS.taskListMode,
          showCompletedTasks: parsed.settings?.showCompletedTasks ?? INITIAL_SETTINGS.showCompletedTasks,
        },
        themes: dedupeThemes([...(Array.isArray(parsed.themes) ? parsed.themes : []), ...builtInThemes]),
      };
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
  }

  const legacyTasksRaw = localStorage.getItem(LEGACY_TASKS_KEY);
  const legacyProjectsRaw = localStorage.getItem(LEGACY_PROJECTS_KEY);
  const legacyTasks = legacyTasksRaw ? (JSON.parse(legacyTasksRaw) as Partial<Task>[]) : INITIAL_TASKS;
  const legacyProjects = legacyProjectsRaw ? (JSON.parse(legacyProjectsRaw) as Partial<Project>[]) : INITIAL_PROJECTS;

  return {
    version: CURRENT_VERSION,
    tasks: legacyTasks.map(normalizeTask),
    projects: legacyProjects.map(normalizeProject),
    settings: INITIAL_SETTINGS,
    themes: builtInThemes,
  };
};

export const createExportPayload = (state: AppStateData): AppDataExport => ({
  version: CURRENT_VERSION,
  exportedAt: new Date().toISOString(),
  app: 'too-much-to-do',
  data: state,
});

export const useAppStore = () => {
  const [state, setState] = useState<AppStateData>(getInitialState);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const addTask = useCallback((
    title: string,
    status: TaskStatus = 'inbox',
    area: string = 'Personal',
    projectId: string | null = null,
    dueDate: string | null = null,
    atStart = false,
    parentId: string | null = null,
  ) => {
    const newTask: Task = {
      id: uid('task'),
      title,
      description: '',
      status,
      isStarred: false,
      projectId,
      area,
      dueDate,
      parentId,
      collapsed: false,
      createdAt: Date.now(),
      tags: [],
    };

    setState((prev) => ({
      ...prev,
      tasks: atStart ? [newTask, ...prev.tasks] : [...prev.tasks, newTask],
    }));

    return newTask;
  }, []);

  const updateTask = useCallback((id: string, updates: Partial<Task>) => {
    setState((prev) => ({
      ...prev,
      tasks: prev.tasks.map((task) => task.id === id ? normalizeTask({ ...task, ...updates, id: task.id }) : task),
    }));
  }, []);

  const reorderTasks = useCallback((sourceId: string, targetId: string) => {
    setState((prev) => {
      const oldIndex = prev.tasks.findIndex((task) => task.id === sourceId);
      const newIndex = prev.tasks.findIndex((task) => task.id === targetId);
      if (oldIndex === -1 || newIndex === -1) return prev;

      const nextTasks = [...prev.tasks];
      const [removed] = nextTasks.splice(oldIndex, 1);
      nextTasks.splice(newIndex, 0, removed);

      return { ...prev, tasks: nextTasks };
    });
  }, []);

  const deleteTask = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      tasks: prev.tasks
        .filter((task) => task.id !== id)
        .map((task) => task.parentId === id ? { ...task, parentId: null } : task),
    }));
  }, []);

  const toggleStar = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      tasks: prev.tasks.map((task) => task.id === id ? { ...task, isStarred: !task.isStarred } : task),
    }));
  }, []);

  const toggleComplete = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      tasks: prev.tasks.map((task) => {
        if (task.id !== id) return task;
        if (task.status === 'completed') {
          return {
            ...task,
            status: task.dueDate ? 'scheduled' : 'next',
          };
        }
        return { ...task, status: 'completed' };
      }),
    }));
  }, []);

  const addProject = useCallback((name: string, parentId: string | null = null, color?: string) => {
    const project: Project = { id: uid('proj'), name, color, parentId };
    setState((prev) => ({ ...prev, projects: [...prev.projects, project] }));
    return project.id;
  }, []);

  const updateProject = useCallback((id: string, updates: Partial<Project>) => {
    setState((prev) => ({
      ...prev,
      projects: prev.projects.map((project) => project.id === id ? normalizeProject({ ...project, ...updates, id: project.id }) : project),
    }));
  }, []);

  const deleteProject = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      projects: prev.projects
        .filter((project) => project.id !== id)
        .map((project) => project.parentId === id ? { ...project, parentId: null } : project),
      tasks: prev.tasks.map((task) => task.projectId === id ? { ...task, projectId: null } : task),
    }));
  }, []);

  const setActiveTheme = useCallback((themeId: string) => {
    setState((prev) => ({ ...prev, settings: { ...prev.settings, activeThemeId: themeId } }));
  }, []);

  const saveTheme = useCallback((theme: ThemeDefinition) => {
    setState((prev) => ({
      ...prev,
      themes: dedupeThemes([...prev.themes.filter((item) => item.id !== theme.id), theme, ...builtInThemes]),
      settings: { ...prev.settings, activeThemeId: theme.id },
    }));
  }, []);

  const importAppData = useCallback((payload: AppDataExport) => {
    const imported = payload.data;
    setState({
      version: CURRENT_VERSION,
      tasks: Array.isArray(imported.tasks) ? imported.tasks.map(normalizeTask) : [],
      projects: Array.isArray(imported.projects) ? imported.projects.map(normalizeProject) : [],
      settings: {
        activeThemeId: imported.settings?.activeThemeId || INITIAL_SETTINGS.activeThemeId,
        plannerWidthMode: (imported.settings?.plannerWidthMode as PlannerWidthMode) || INITIAL_SETTINGS.plannerWidthMode,
        taskListMode: (imported.settings?.taskListMode as TaskListMode) || INITIAL_SETTINGS.taskListMode,
        showCompletedTasks: imported.settings?.showCompletedTasks ?? INITIAL_SETTINGS.showCompletedTasks,
      },
      themes: dedupeThemes([...(Array.isArray(imported.themes) ? imported.themes : []), ...builtInThemes]),
    });
  }, []);

  const importTaskListData = useCallback((payload: TaskListExchange, mode: TaskListImportMode) => {
    setState((prev) => {
      const scope = payload.scope;
      const isInScope = (task: Task) => scope.type === 'inbox' ? task.status === 'inbox' : task.projectId === scope.projectId;
      const existingScopeIds = new Set(prev.tasks.filter(isInScope).map((task) => task.id));
      const preservedTasks = mode === 'replace-list' ? prev.tasks.filter((task) => !isInScope(task)) : prev.tasks;

      let nextProjects = [...prev.projects];
      const projectIdMap = new Map<string, string>();

      for (const project of payload.projects || []) {
        const normalized = normalizeProject(project);
        const existing = nextProjects.find((item) => item.id === normalized.id);
        if (existing) {
          projectIdMap.set(project.id, existing.id);
          if (mode !== 'append') {
            nextProjects = nextProjects.map((item) => item.id === existing.id ? normalizeProject({ ...item, ...normalized, id: item.id }) : item);
          }
          continue;
        }
        nextProjects.push(normalized);
        projectIdMap.set(project.id, normalized.id);
      }

      if (scope.type === 'project' && !nextProjects.some((project) => project.id === scope.projectId)) {
        nextProjects.push(normalizeProject({ id: scope.projectId, name: 'Imported Project', parentId: null }));
      }

      const incomingTasks = Array.isArray(payload.tasks) ? payload.tasks : [];
      const incomingIds = new Set(incomingTasks.map((task) => task.id));
      const idMap = new Map<string, string>();
      const occupiedIds = new Set(preservedTasks.map((task) => task.id));

      for (const task of incomingTasks) {
        let nextId = typeof task.id === 'string' && task.id.trim() ? task.id : uid('task');
        if (mode === 'append') nextId = uid('task');
        else if (mode === 'upsert' && occupiedIds.has(nextId) && !existingScopeIds.has(nextId)) nextId = uid('task');
        else if (mode === 'replace-list' && occupiedIds.has(nextId)) nextId = uid('task');
        idMap.set(task.id, nextId);
        occupiedIds.add(nextId);
      }

      const normalizedImportedTasks = incomingTasks.map((task) => {
        const normalized = normalizeTask(task);
        const mappedId = idMap.get(task.id) || uid('task');
        const mappedParentId = normalized.parentId && incomingIds.has(normalized.parentId) ? idMap.get(normalized.parentId) || null : null;
        const mappedProjectId = normalized.projectId ? (projectIdMap.get(normalized.projectId) || normalized.projectId) : null;

        return normalizeTask({
          ...normalized,
          id: mappedId,
          parentId: mappedParentId,
          projectId: scope.type === 'project' ? scope.projectId : mappedProjectId,
          status: scope.type === 'inbox' ? 'inbox' : normalized.status,
        });
      });

      if (mode === 'upsert') {
        const importById = new Map(normalizedImportedTasks.map((task) => [task.id, task]));
        const updated = prev.tasks.map((task) => {
          const candidate = importById.get(task.id);
          return candidate ? normalizeTask({ ...task, ...candidate, id: task.id }) : task;
        });
        const knownIds = new Set(updated.map((task) => task.id));
        const additions = normalizedImportedTasks.filter((task) => !knownIds.has(task.id));
        return { ...prev, projects: nextProjects, tasks: [...updated, ...additions] };
      }

      return {
        ...prev,
        projects: nextProjects,
        tasks: [...preservedTasks, ...normalizedImportedTasks],
      };
    });
  }, []);

  const setPlannerWidthMode = useCallback((plannerWidthMode: PlannerWidthMode) => {
    setState((prev) => ({ ...prev, settings: { ...prev.settings, plannerWidthMode } }));
  }, []);

  const setTaskListMode = useCallback((taskListMode: TaskListMode) => {
    setState((prev) => ({ ...prev, settings: { ...prev.settings, taskListMode } }));
  }, []);

  const setShowCompletedTasks = useCallback((showCompletedTasks: boolean) => {
    setState((prev) => ({ ...prev, settings: { ...prev.settings, showCompletedTasks } }));
  }, []);

  const setTaskParent = useCallback((taskId: string, parentId: string | null) => {
    setState((prev) => ({ ...prev, tasks: updateTaskParent(prev.tasks, taskId, parentId) }));
  }, []);

  const moveTaskBefore = useCallback((sourceId: string, targetId: string, parentId: string | null) => {
    setState((prev) => ({ ...prev, tasks: moveTaskSubtree(prev.tasks, sourceId, targetId, 'before', parentId) }));
  }, []);

  const moveTaskAfter = useCallback((sourceId: string, targetId: string, parentId: string | null) => {
    setState((prev) => ({ ...prev, tasks: moveTaskSubtree(prev.tasks, sourceId, targetId, 'after', parentId) }));
  }, []);

  const moveTaskBeforeFlat = useCallback((sourceId: string, targetId: string) => {
    setState((prev) => ({ ...prev, tasks: moveTaskSubtreePreserveParent(prev.tasks, sourceId, targetId, 'before') }));
  }, []);

  const moveTaskAfterFlat = useCallback((sourceId: string, targetId: string) => {
    setState((prev) => ({ ...prev, tasks: moveTaskSubtreePreserveParent(prev.tasks, sourceId, targetId, 'after') }));
  }, []);

  const toggleTaskCollapsed = useCallback((taskId: string) => {
    setState((prev) => ({
      ...prev,
      tasks: prev.tasks.map((task) => task.id === taskId ? { ...task, collapsed: !task.collapsed } : task),
    }));
  }, []);

  const activeTheme = useMemo(() => {
    return state.themes.find((theme) => theme.id === state.settings.activeThemeId) || builtInThemes[0];
  }, [state.themes, state.settings.activeThemeId]);

  return {
    ...state,
    activeTheme,
    addTask,
    updateTask,
    reorderTasks,
    deleteTask,
    toggleStar,
    toggleComplete,
    addProject,
    updateProject,
    deleteProject,
    setActiveTheme,
    setPlannerWidthMode,
    setTaskListMode,
    setShowCompletedTasks,
    setTaskParent,
    moveTaskBefore,
    moveTaskAfter,
    moveTaskBeforeFlat,
    moveTaskAfterFlat,
    toggleTaskCollapsed,
    saveTheme,
    importAppData,
    importTaskListData,
  };
};
