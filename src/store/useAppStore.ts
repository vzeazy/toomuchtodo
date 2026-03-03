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
  DayPart,
  ThemeDefinition,
  TimerState,
} from '../types';

const STORAGE_KEY = 'too_much_to_do_state_v1';
const LEGACY_TASKS_KEY = 'too_much_to_do_legacy_tasks';
const LEGACY_PROJECTS_KEY = 'too_much_to_do_legacy_projects';
const CURRENT_VERSION = 1;

const INITIAL_PROJECTS: Project[] = [];
const LEGACY_BOOTSTRAP_PROJECT_COLORS = new Map<string, string>();

const INITIAL_TASKS: Task[] = [];

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
  duration: 1800, // 30 minutes default
  remaining: 1800,
  linkedTaskId: null,
  sessionTitle: null,
  lastTick: null,
  finished: false,
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
  dayPart: task.dayPart === 'morning' || task.dayPart === 'afternoon' || task.dayPart === 'evening' ? task.dayPart : null,
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
          hideEmptyProjectsInPlanner: parsed.settings?.hideEmptyProjectsInPlanner ?? INITIAL_SETTINGS.hideEmptyProjectsInPlanner,
          compactEmptyDaysInPlanner: parsed.settings?.compactEmptyDaysInPlanner ?? INITIAL_SETTINGS.compactEmptyDaysInPlanner,
          startPlannerOnToday: parsed.settings?.startPlannerOnToday ?? INITIAL_SETTINGS.startPlannerOnToday,
          groupDayViewByPart: parsed.settings?.groupDayViewByPart ?? INITIAL_SETTINGS.groupDayViewByPart,
        },
        themes: dedupeThemes([...(Array.isArray(parsed.themes) ? parsed.themes : []), ...builtInThemes]),
        timer: parsed.timer || INITIAL_TIMER_STATE,
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
    timer: INITIAL_TIMER_STATE,
  };
};

export const createExportPayload = (state: AppStateData): AppDataExport => ({
  version: CURRENT_VERSION,
  exportedAt: new Date().toISOString(),
  app: 'too-much-to-do',
  data: state,
});

let memoryState: AppStateData | null = null;
const listeners = new Set<() => void>();

function getSharedState() {
  if (!memoryState) memoryState = getInitialState();
  return memoryState;
}

function setSharedState(next: AppStateData | ((prev: AppStateData) => AppStateData)) {
  const prev = getSharedState();
  memoryState = typeof next === 'function' ? next(prev) : next;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(memoryState));
  listeners.forEach((l) => l());
}

export const useAppStore = () => {
  const [state, setLocalState] = useState<AppStateData>(getSharedState);

  useEffect(() => {
    const listener = () => setLocalState(getSharedState());
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  const addTask = useCallback((
    title: string,
    status: TaskStatus = 'inbox',
    area: string = 'Personal',
    projectId: string | null = null,
    dueDate: string | null = null,
    atStart = false,
    parentId: string | null = null,
    dayPart: DayPart | null = null,
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
      dayPart,
      parentId,
      collapsed: false,
      createdAt: Date.now(),
      tags: [],
    };

    setSharedState((prev) => ({
      ...prev,
      tasks: atStart ? [newTask, ...prev.tasks] : [...prev.tasks, newTask],
    }));

    return newTask;
  }, []);

  const updateTask = useCallback((id: string, updates: Partial<Task>) => {
    setSharedState((prev) => ({
      ...prev,
      tasks: prev.tasks.map((task) => task.id === id ? normalizeTask({ ...task, ...updates, id: task.id }) : task),
    }));
  }, []);

  const reorderTasks = useCallback((sourceId: string, targetId: string) => {
    setSharedState((prev) => {
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
    setSharedState((prev) => ({
      ...prev,
      tasks: prev.tasks
        .filter((task) => task.id !== id)
        .map((task) => task.parentId === id ? { ...task, parentId: null } : task),
    }));
  }, []);

  const toggleStar = useCallback((id: string) => {
    setSharedState((prev) => ({
      ...prev,
      tasks: prev.tasks.map((task) => task.id === id ? { ...task, isStarred: !task.isStarred } : task),
    }));
  }, []);

  const toggleComplete = useCallback((id: string) => {
    setSharedState((prev) => ({
      ...prev,
      tasks: prev.tasks.map((task) => {
        if (task.id !== id) return task;
        if (task.status === 'completed') {
          return {
            ...task,
            status: task.dueDate ? 'scheduled' : (task.projectId ? 'open' : 'next'),
          };
        }
        return { ...task, status: 'completed' };
      }),
    }));
  }, []);

  const addProject = useCallback((name: string, parentId: string | null = null, color?: string) => {
    const project: Project = { id: uid('proj'), name, color, parentId };
    setSharedState((prev) => ({ ...prev, projects: [...prev.projects, project] }));
    return project.id;
  }, []);

  const updateProject = useCallback((id: string, updates: Partial<Project>) => {
    setSharedState((prev) => ({
      ...prev,
      projects: prev.projects.map((project) => project.id === id ? normalizeProject({ ...project, ...updates, id: project.id }) : project),
    }));
  }, []);

  const deleteProject = useCallback((id: string, deleteTasks = false) => {
    setSharedState((prev) => {
      const removedTaskIds = new Set(
        deleteTasks
          ? prev.tasks.filter((task) => task.projectId === id).map((task) => task.id)
          : [],
      );

      return {
        ...prev,
        projects: prev.projects
          .filter((project) => project.id !== id)
          .map((project) => project.parentId === id ? { ...project, parentId: null } : project),
        tasks: deleteTasks
          ? prev.tasks
            .filter((task) => !removedTaskIds.has(task.id))
            .map((task) => removedTaskIds.has(task.parentId || '') ? { ...task, parentId: null } : task)
          : prev.tasks.map((task) => task.projectId === id ? { ...task, projectId: null } : task),
      };
    });
  }, []);

  const setActiveTheme = useCallback((themeId: string) => {
    setSharedState((prev) => ({ ...prev, settings: { ...prev.settings, activeThemeId: themeId } }));
  }, []);

  const saveTheme = useCallback((theme: ThemeDefinition) => {
    setSharedState((prev) => ({
      ...prev,
      themes: dedupeThemes([...prev.themes.filter((item) => item.id !== theme.id), theme, ...builtInThemes]),
      settings: { ...prev.settings, activeThemeId: theme.id },
    }));
  }, []);

  const importAppData = useCallback((payload: AppDataExport) => {
    const imported = payload.data;
    setSharedState({
      version: CURRENT_VERSION,
      tasks: Array.isArray(imported.tasks) ? imported.tasks.map(normalizeTask) : [],
      projects: Array.isArray(imported.projects) ? imported.projects.map(normalizeProject) : [],
      settings: {
        activeThemeId: imported.settings?.activeThemeId || INITIAL_SETTINGS.activeThemeId,
        plannerWidthMode: (imported.settings?.plannerWidthMode as PlannerWidthMode) || INITIAL_SETTINGS.plannerWidthMode,
        taskListMode: (imported.settings?.taskListMode as TaskListMode) || INITIAL_SETTINGS.taskListMode,
        showCompletedTasks: imported.settings?.showCompletedTasks ?? INITIAL_SETTINGS.showCompletedTasks,
        hideEmptyProjectsInPlanner: imported.settings?.hideEmptyProjectsInPlanner ?? INITIAL_SETTINGS.hideEmptyProjectsInPlanner,
        compactEmptyDaysInPlanner: imported.settings?.compactEmptyDaysInPlanner ?? INITIAL_SETTINGS.compactEmptyDaysInPlanner,
        startPlannerOnToday: imported.settings?.startPlannerOnToday ?? INITIAL_SETTINGS.startPlannerOnToday,
        groupDayViewByPart: imported.settings?.groupDayViewByPart ?? INITIAL_SETTINGS.groupDayViewByPart,
      },
      themes: dedupeThemes([...(Array.isArray(imported.themes) ? imported.themes : []), ...builtInThemes]),
      timer: imported.timer || INITIAL_TIMER_STATE,
    });
  }, []);

  const importTaskListData = useCallback((payload: TaskListExchange, mode: TaskListImportMode) => {
    setSharedState((prev) => {
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
    setSharedState((prev) => ({ ...prev, settings: { ...prev.settings, plannerWidthMode } }));
  }, []);

  const setTaskListMode = useCallback((taskListMode: TaskListMode) => {
    setSharedState((prev) => ({ ...prev, settings: { ...prev.settings, taskListMode } }));
  }, []);

  const setShowCompletedTasks = useCallback((showCompletedTasks: boolean) => {
    setSharedState((prev) => ({ ...prev, settings: { ...prev.settings, showCompletedTasks } }));
  }, []);

  const toggleHideEmptyProjectsInPlanner = useCallback(() => {
    setSharedState((prev) => ({ ...prev, settings: { ...prev.settings, hideEmptyProjectsInPlanner: !prev.settings.hideEmptyProjectsInPlanner } }));
  }, []);

  const toggleCompactEmptyDaysInPlanner = useCallback(() => {
    setSharedState((prev) => ({ ...prev, settings: { ...prev.settings, compactEmptyDaysInPlanner: !prev.settings.compactEmptyDaysInPlanner } }));
  }, []);

  const toggleStartPlannerOnToday = useCallback(() => {
    setSharedState((prev) => ({ ...prev, settings: { ...prev.settings, startPlannerOnToday: !prev.settings.startPlannerOnToday } }));
  }, []);

  const toggleGroupDayViewByPart = useCallback(() => {
    setSharedState((prev) => ({ ...prev, settings: { ...prev.settings, groupDayViewByPart: !prev.settings.groupDayViewByPart } }));
  }, []);

  const setTaskParent = useCallback((taskId: string, parentId: string | null) => {
    setSharedState((prev) => ({ ...prev, tasks: updateTaskParent(prev.tasks, taskId, parentId) }));
  }, []);

  const moveTaskBefore = useCallback((sourceId: string, targetId: string, parentId: string | null) => {
    setSharedState((prev) => ({ ...prev, tasks: moveTaskSubtree(prev.tasks, sourceId, targetId, 'before', parentId) }));
  }, []);

  const moveTaskAfter = useCallback((sourceId: string, targetId: string, parentId: string | null) => {
    setSharedState((prev) => ({ ...prev, tasks: moveTaskSubtree(prev.tasks, sourceId, targetId, 'after', parentId) }));
  }, []);

  const moveTaskBeforeFlat = useCallback((sourceId: string, targetId: string) => {
    setSharedState((prev) => ({ ...prev, tasks: moveTaskSubtreePreserveParent(prev.tasks, sourceId, targetId, 'before') }));
  }, []);

  const moveTaskAfterFlat = useCallback((sourceId: string, targetId: string) => {
    setSharedState((prev) => ({ ...prev, tasks: moveTaskSubtreePreserveParent(prev.tasks, sourceId, targetId, 'after') }));
  }, []);

  const toggleTaskCollapsed = useCallback((taskId: string) => {
    setSharedState((prev) => ({
      ...prev,
      tasks: prev.tasks.map((task) => task.id === taskId ? { ...task, collapsed: !task.collapsed } : task),
    }));
  }, []);

  const startTimer = useCallback((duration: number, linkedTaskId: string | null = null, sessionTitle: string | null = null) => {
    setSharedState((prev) => ({
      ...prev,
      timer: {
        active: true,
        paused: false,
        duration,
        remaining: duration,
        linkedTaskId,
        sessionTitle,
        lastTick: Date.now(),
        finished: false,
      }
    }));
  }, []);

  const pauseTimer = useCallback(() => {
    setSharedState((prev) => ({
      ...prev,
      timer: { ...prev.timer, paused: true, lastTick: null }
    }));
  }, []);

  const resumeTimer = useCallback(() => {
    setSharedState((prev) => ({
      ...prev,
      timer: { ...prev.timer, paused: false, lastTick: Date.now() }
    }));
  }, []);

  const stopTimer = useCallback(() => {
    setSharedState((prev) => ({
      ...prev,
      timer: INITIAL_TIMER_STATE
    }));
  }, []);

  const tickTimer = useCallback(() => {
    setSharedState((prev) => {
      if (!prev.timer.active || prev.timer.paused || !prev.timer.lastTick) return prev;
      const now = Date.now();
      const deltaSeconds = Math.round((now - prev.timer.lastTick) / 1000);

      if (deltaSeconds < 1) return prev; // Not enough time elapsed

      const nextRemaining = Math.max(0, prev.timer.remaining - deltaSeconds);

      if (nextRemaining === 0) {
        // Option to handle timer completion here (e.g. stop automatically)
        return {
          ...prev,
          timer: { ...prev.timer, remaining: 0, paused: true, active: true, finished: true, lastTick: null }
        };
      }

      return {
        ...prev,
        timer: { ...prev.timer, remaining: nextRemaining, lastTick: now }
      };
    });
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
    toggleHideEmptyProjectsInPlanner,
    toggleCompactEmptyDaysInPlanner,
    toggleStartPlannerOnToday,
    toggleGroupDayViewByPart,
    startTimer,
    pauseTimer,
    resumeTimer,
    stopTimer,
    tickTimer,
  };
};
