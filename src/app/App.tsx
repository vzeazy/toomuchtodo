import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlignLeft,
  Calendar,
  CalendarClock,
  CalendarDays,
  ChevronDown,

  ChevronLeft,
  ChevronRight,
  ChevronsRight,
  Clock,
  Cloud,
  Coffee,
  Columns,
  Eye,
  EyeOff,
  FileText,
  Folder,
  Inbox,
  Keyboard,
  LayoutList,
  List,
  PanelsTopLeft,
  Maximize2,
  Minimize2,
  MoreHorizontal,
  Palette,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Search,
  Settings,
  Star,
  Trash2,

} from 'lucide-react';
import { SidebarItem } from '../components/SidebarItem';
import { ShortcutsModal } from '../components/ShortcutsModal';
import { copyTextToClipboard } from '../lib/clipboard';
import { formatDateKey, getWeekDays, getWeekRangeLabel } from '../lib/date';
import { flattenProjectTree, getParentTaskCountsByProject } from '../lib/projectTree';
import { searchTasks } from '../lib/taskSearch';
import {
  createTaskListExchangePayload,
  createTaskListMarkdown,
  createTaskListProgressPrompt,
  isTaskListExchange,
} from '../lib/taskListExchange';
import { getThemeVariables } from '../lib/theme';
import { createExportPayload, useAppStore } from '../store/useAppStore';
import { AppDataExport, AppView, NoteScopeType, PlannerWidthMode, Task, TaskListMode, TaskListImportMode, TaskListScope, TaskStatus } from '../types';
import { useAppLocation } from '../lib/useAppLocation';
import { CommandItem, CommandPalette } from '../features/command-palette/CommandPalette';
import { NotesDashboardView } from '../features/notes/NotesDashboardView';
import { PlannerView } from '../features/planner/PlannerView';
import { SearchView } from '../features/search/SearchView';
import { SettingsView } from '../features/settings/SettingsView';
import { AccountSyncModal } from '../features/settings/AccountSyncModal';
import { TaskListView } from '../features/tasks/TaskListView';
import { TaskModal } from '../features/tasks/TaskModal';
import { TaskPanelWrapper, PanelState } from '../features/tasks/TaskPanelWrapper';
import { collectTaskIdsWithAncestors } from '../features/tasks/taskTree';
import { GlobalTimerOverlay } from '../components/timer/GlobalTimerOverlay';
import { GlobalTimerTrigger } from '../components/timer/GlobalTimerTrigger';

const AREAS = ['Personal', 'Work', 'Leisure', 'Finance'];
const PROJECT_COLORS = ['#5ea1ff', '#71d7c7', '#f2b56b', '#ef7d7d', '#c792ea', '#9bd26f', '#f78fb3'];

const downloadJson = (filename: string, payload: unknown) => {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};

const isAppExport = (value: unknown): value is AppDataExport => {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<AppDataExport>;
  return candidate.app === 'too-much-to-do' && typeof candidate.version === 'number' && !!candidate.data;
};

export default function App() {
  const {
    tasks,
    projects,
    notes,
    themes,
    settings,
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
    addNote,
    updateNote,
    deleteNote,
    toggleNotePinned,
    setActiveTheme,
    setPlannerWidthMode,
    setTaskListMode,
    setTaskParent,
    moveTaskBefore,
    moveTaskAfter,
    moveTaskBeforeFlat,
    moveTaskAfterFlat,
    toggleTaskCollapsed,
    saveTheme,
    importAppData,
    importTaskListData,
    setShowCompletedTasks,
    toggleHideEmptyProjectsInPlanner,
    toggleCompactEmptyDaysInPlanner,
    toggleStartPlannerOnToday,
    toggleGroupDayViewByPart,
    timer,
    startTimer,
    pauseTimer,
    resumeTimer,
    stopTimer,
    toggleTimerMinimized,
    syncMeta,
    syncStatus,
    authSession,
    refreshSession,
    signUp,
    signIn,
    signOut,
    setCloudLinked,
    runSyncNow,
  } = useAppStore();

  const {
    view: currentView,
    projectId: selectedProjectId,
    dateStr: selectedPlannerDate,
    weekOffset: currentWeekOffset,
    navigate,
  } = useAppLocation();
  const [selectedArea, setSelectedArea] = useState<string | null>(null);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [showAreaMenu, setShowAreaMenu] = useState(false);
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
  const [showShortcutsModal, setShowShortcutsModal] = useState(false);
  const [showAccountSyncModal, setShowAccountSyncModal] = useState(false);
  const [taskToEditInModal, setTaskToEditInModal] = useState<Task | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [projectMenuId, setProjectMenuId] = useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showMobileToolbarMenu, setShowMobileToolbarMenu] = useState(false);
  const [notesViewFocus, setNotesViewFocus] = useState<{ scopeType: NoteScopeType | 'all'; scopeRef: string | null; noteId: string | null }>({
    scopeType: 'all',
    scopeRef: null,
    noteId: null,
  });

  const [additionalPanels, setAdditionalPanels] = useState<PanelState[]>([]);
  const themeVariables = useMemo(() => getThemeVariables(activeTheme), [activeTheme]);
  const isCompactViewport = useCallback(() => typeof window !== 'undefined' && window.innerWidth < 1024, []);
  const toggleSidebarCollapsed = useCallback(() => {
    setSidebarCollapsed((prev) => !prev);
    setShowAreaMenu(false);
    setProjectMenuId(null);
    setShowMobileToolbarMenu(false);
  }, []);
  const collapseSidebarForMobileNavigation = useCallback(() => {
    if (!isCompactViewport()) return;
    setSidebarCollapsed(true);
    setShowAreaMenu(false);
    setProjectMenuId(null);
  }, [isCompactViewport]);

  const handleViewSelect = useCallback((event: React.MouseEvent | undefined, view: AppView, projectId: string | null = null, dateStr: string | null = null) => {
    const isMulti = event && (event.shiftKey || event.metaKey || event.ctrlKey);
    if (isMulti && currentView !== 'planner' && currentView !== 'settings' && currentView !== 'search' && currentView !== 'notes') {
      // Prevent duplicates
      if (currentView === view && selectedProjectId === projectId && selectedPlannerDate === dateStr) return;
      setAdditionalPanels((prev) => {
        if (prev.some(p => p.view === view && p.projectId === projectId && p.dateStr === dateStr)) return prev;
        return [...prev, { id: Math.random().toString(), view, projectId, dateStr }];
      });
    } else {
      navigate({ view, projectId, dateStr });
      setAdditionalPanels([]);
      collapseSidebarForMobileNavigation();
    }
  }, [collapseSidebarForMobileNavigation, currentView, navigate, selectedProjectId, selectedPlannerDate]);

  const newTaskInputRef = useRef<HTMLInputElement>(null);
  const sidebarSearchRef = useRef<HTMLInputElement>(null);

  const todayDateKey = formatDateKey(new Date());
  const weekDays = useMemo(() => getWeekDays(currentWeekOffset, settings.startPlannerOnToday), [currentWeekOffset, settings.startPlannerOnToday]);
  const weekRangeLabel = useMemo(() => getWeekRangeLabel(weekDays), [weekDays]);
  const selectedDayLabel = useMemo(() => {
    if (currentView !== 'day' || !selectedPlannerDate) return null;
    const date = new Date(`${selectedPlannerDate}T00:00:00`);
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  }, [currentView, selectedPlannerDate]);

  const shiftSelectedDay = useCallback((delta: number) => {
    const base = selectedPlannerDate ? new Date(`${selectedPlannerDate}T00:00:00`) : new Date();
    base.setHours(0, 0, 0, 0);
    base.setDate(base.getDate() + delta);
    navigate({ view: 'day', projectId: null, dateStr: formatDateKey(base) });
  }, [navigate, selectedPlannerDate]);

  const counts = useMemo(() => {
    let activeTasks = tasks;
    if (!settings.showCompletedTasks) {
      activeTasks = activeTasks.filter(t => t.status !== 'completed');
    }
    return {
      inbox: activeTasks.filter((task) => task.status === 'inbox').length,
      focus: activeTasks.filter((task) => task.isStarred && task.status !== 'completed').length,
      today: activeTasks.filter((task) => task.dueDate === todayDateKey && task.status !== 'completed').length,
      next: activeTasks.filter((task) => task.status === 'next').length,
      waiting: activeTasks.filter((task) => task.status === 'waiting').length,
      scheduled: activeTasks.filter((task) => task.status === 'scheduled' || (task.status === 'completed' && task.dueDate)).length,
      someday: activeTasks.filter((task) => task.status === 'someday').length,
      completed: tasks.filter((task) => task.status === 'completed').length,
    };
  }, [tasks, settings.showCompletedTasks, todayDateKey]);

  const searchResults = useMemo(() => {
    return searchTasks(tasks, projects, searchQuery, { includeCompleted: settings.showCompletedTasks });
  }, [projects, searchQuery, tasks, settings.showCompletedTasks]);
  const activeNotes = useMemo(() => notes.filter((note) => note.deletedAt === null), [notes]);

  const openNotesDashboard = useCallback((scopeType: NoteScopeType | 'all' = 'all', scopeRef: string | null = null, noteId: string | null = null) => {
    setNotesViewFocus({ scopeType, scopeRef, noteId });
    handleViewSelect(undefined, 'notes');
  }, [handleViewSelect]);



  const projectTree = useMemo(() => flattenProjectTree(projects), [projects]);
  const projectParentTaskCounts = useMemo(
    () => getParentTaskCountsByProject(projects, tasks, selectedArea),
    [projects, selectedArea, tasks]
  );



  const handleAddNewTask = useCallback((event?: React.FormEvent) => {
    event?.preventDefault();
    if (!newTaskTitle.trim()) return;
    addTask(newTaskTitle.trim(), selectedProjectId ? 'open' : 'inbox', selectedArea || 'Personal', selectedProjectId, null, true);
    setNewTaskTitle('');
  }, [addTask, newTaskTitle, selectedArea, selectedProjectId]);

  const commands = useMemo<CommandItem[]>(() => [
    { id: 'goto-inbox', label: 'Go to Inbox', hint: 'Navigation', run: () => handleViewSelect(undefined, 'inbox') },
    { id: 'goto-next', label: 'Go to Next', hint: 'Navigation', run: () => handleViewSelect(undefined, 'next') },
    { id: 'goto-planner', label: 'Go to Planner', hint: 'Navigation', run: () => handleViewSelect(undefined, 'planner') },
    { id: 'goto-notes', label: 'Open Notes', hint: 'Navigation', run: () => openNotesDashboard() },
    { id: 'goto-search', label: 'Open Search', hint: 'Navigation', run: () => { handleViewSelect(undefined, 'search'); sidebarSearchRef.current?.focus(); } },
    { id: 'goto-settings', label: 'Open Settings', hint: 'Navigation', run: () => handleViewSelect(undefined, 'settings') },
    { id: 'new-task', label: 'Focus New Task Input', hint: 'Task', run: () => newTaskInputRef.current?.focus() },
    {
      id: 'new-dashboard-note',
      label: 'New Dashboard Note',
      hint: 'Note',
      run: () => {
        const note = addNote({ scopeType: 'dashboard', scopeRef: null });
        openNotesDashboard('dashboard', null, note.id);
      },
    },
    {
      id: 'toggle-theme', label: 'Cycle Theme', hint: 'Theme', run: () => {
        const currentIndex = themes.findIndex((theme) => theme.id === settings.activeThemeId);
        const nextTheme = themes[(currentIndex + 1) % themes.length];
        setActiveTheme(nextTheme.id);
      }
    },
    { id: 'export-data', label: 'Export Data', hint: 'Data', run: () => downloadJson(`too-much-to-do-export-${new Date().toISOString().slice(0, 10)}.json`, createExportPayload({ version: 1, tasks, projects, notes, settings, themes, timer })) },
    { id: 'shortcuts', label: 'Open Keyboard Shortcuts', hint: 'Help', run: () => setShowShortcutsModal(true) },
    { id: 'timer-25', label: 'Start 25m Timer', hint: 'Timer', run: () => startTimer(25 * 60, null, 'Focus Session') },
    { id: 'timer-toggle-minimize', label: timer.minimized ? 'Expand Timer Overlay' : 'Minimize Timer Overlay', hint: 'Timer', run: () => toggleTimerMinimized(), disabled: !timer.active },
  ], [addNote, handleViewSelect, notes, openNotesDashboard, projects, settings, tasks, themes, timer, setActiveTheme, startTimer, toggleTimerMinimized]);

  const resolveCommandPaletteQuery = useCallback((rawQuery: string): CommandItem[] | null => {
    const query = rawQuery.trim();
    const lower = query.toLowerCase();

    if (lower.startsWith('s:')) {
      const term = query.slice(2).trim();
      if (!term) {
        return [{ id: 'search-help', label: 'Type after s: to search tasks', hint: 'Search', run: () => undefined, disabled: true }];
      }
      const results = searchTasks(tasks, projects, term, { includeCompleted: settings.showCompletedTasks }).slice(0, 12);
      return [
        {
          id: 'search-open-view',
          label: `Open full search for "${term}"`,
          hint: 'Search',
          run: () => {
            setSearchQuery(term);
            handleViewSelect(undefined, 'search');
          },
        },
        ...results.map((task) => {
          const projectLabel = projects.find((project) => project.id === task.projectId)?.name || 'No Project';
          return {
            id: `search-task-${task.id}`,
            label: task.title,
            hint: `${projectLabel} · ${task.status}`,
            run: () => setTaskToEditInModal(task),
          };
        }),
      ];
    }

    if (lower.startsWith('t:')) {
      const title = query.slice(2).trim();
      if (!title) {
        return [{ id: 'task-help', label: 'Type after t: to add a task', hint: 'Task', run: () => undefined, disabled: true }];
      }
      return [
        {
          id: 'task-add-context',
          label: `Add task: ${title}`,
          hint: selectedProjectId ? 'Task · Current Project' : 'Task · Inbox',
          run: () => {
            addTask(title, selectedProjectId ? 'open' : 'inbox', selectedArea || 'Personal', selectedProjectId, null, true);
          },
        },
      ];
    }

    if (lower.startsWith('note:') || lower.startsWith('no:')) {
      const title = query.slice(query.indexOf(':') + 1).trim();
      if (!title) {
        return [{ id: 'note-help', label: 'Type after note: to create a dashboard note', hint: 'Note', run: () => undefined, disabled: true }];
      }
      return [
        {
          id: 'note-add-dashboard',
          label: `Create note: ${title}`,
          hint: 'Note · Dashboard',
          run: () => {
            const note = addNote({ scopeType: 'dashboard', scopeRef: null, title });
            openNotesDashboard('dashboard', null, note.id);
          },
        },
      ];
    }

    const isTimerPrefix = lower.startsWith('timer:') || lower.startsWith('ti:');
    if (isTimerPrefix) {
      const rest = query.includes(':') ? query.slice(query.indexOf(':') + 1).trim() : '';
      const match = rest.match(/^(\d+)(?:\s+(.*))?$/);
      const explicitMinutes = match ? Number.parseInt(match[1], 10) : null;
      const minutes = explicitMinutes ? Math.max(1, Math.min(240, explicitMinutes)) : 25;
      const title = match?.[2]?.trim() || (!match && rest ? rest : '');
      const sessionTitle = title || 'Focus Session';
      const timerActions: CommandItem[] = [
        {
          id: 'timer-start-custom',
          label: rest ? `Start ${minutes}m Timer${title ? ` · ${title}` : ''}` : 'Start 25m Focus Timer',
          hint: 'Timer',
          run: () => startTimer(minutes * 60, null, sessionTitle),
        },
      ];

      if (timer.active) {
        timerActions.unshift(
          {
            id: timer.paused ? 'timer-resume' : 'timer-pause',
            label: timer.paused ? 'Resume Active Timer' : 'Pause Active Timer',
            hint: 'Timer',
            run: () => (timer.paused ? resumeTimer() : pauseTimer()),
          },
          {
            id: 'timer-stop',
            label: 'Stop Active Timer',
            hint: 'Timer',
            run: () => stopTimer(),
          },
          {
            id: 'timer-toggle-size',
            label: timer.minimized ? 'Expand Timer Overlay' : 'Minimize Timer Overlay',
            hint: 'Timer',
            run: () => toggleTimerMinimized(),
          }
        );
      }

      return timerActions;
    }

    return null;
  }, [
    addNote,
    addTask,
    handleViewSelect,
    pauseTimer,
    projects,
    resumeTimer,
    selectedArea,
    selectedProjectId,
    settings.showCompletedTasks,
    startTimer,
    stopTimer,
    tasks,
    timer.active,
    timer.minimized,
    timer.paused,
    toggleTimerMinimized,
    openNotesDashboard,
  ]);

  const plannerWidthOptions: Array<{ id: PlannerWidthMode; label: string; icon: typeof Columns }> = [
    { id: 'container', label: 'Fit', icon: Columns },
    { id: 'wide', label: 'Wide', icon: Minimize2 },
    { id: 'full', label: 'Full', icon: Maximize2 },
  ];

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      const isTypingTarget = ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable;

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setShowCommandPalette((prev) => !prev);
        return;
      }

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'b') {
        event.preventDefault();
        toggleSidebarCollapsed();
        return;
      }

      if (isTypingTarget) {
        if (event.key === 'Escape') target.blur();
        return;
      }

      if (event.key === '/') {
        event.preventDefault();
        handleViewSelect(undefined, 'search');
        sidebarSearchRef.current?.focus();
        return;
      }

      const key = event.key.toLowerCase();
      switch (key) {
        case 'n':
          event.preventDefault();
          newTaskInputRef.current?.focus();
          break;
        case 'k':
          event.preventDefault();
          setShowShortcutsModal((prev) => !prev);
          break;
        case 'i':
          event.preventDefault();
          addTask('New Inbox Item', 'inbox', selectedArea || 'Personal');
          break;
        case 'x':
          event.preventDefault();
          addTask('New Next Action', 'next', selectedArea || 'Personal');
          break;
        case '8':
          handleViewSelect(undefined, 'planner');
          break;
        case '1':
        case '2':
        case '3':
        case '4':
        case '5':
        case '6':
        case '7': {
          const views: AppView[] = ['inbox', 'next', 'waiting', 'scheduled', 'someday', 'focus', 'completed'];
          handleViewSelect(undefined, views[Number.parseInt(key, 10) - 1]);
          break;
        }
        case '[':
          if (event.shiftKey) {
            const index = selectedArea ? AREAS.indexOf(selectedArea) : -1;
            const nextIndex = (index - 1 + AREAS.length + 1) % (AREAS.length + 1);
            setSelectedArea(nextIndex === AREAS.length ? null : AREAS[nextIndex]);
          }
          break;
        case ']':
          if (event.shiftKey) {
            const index = selectedArea ? AREAS.indexOf(selectedArea) : -1;
            const nextIndex = (index + 1) % (AREAS.length + 1);
            setSelectedArea(nextIndex === AREAS.length ? null : AREAS[nextIndex]);
          }
          break;
        case ',':
          event.preventDefault();
          handleViewSelect(undefined, 'settings');
          break;
        case 'h':
          event.preventDefault();
          setShowCompletedTasks(!settings.showCompletedTasks);
          break;
        case 't':
          event.preventDefault();
          handleViewSelect(undefined, 'day', null, todayDateKey);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [addTask, handleViewSelect, selectedArea, settings.showCompletedTasks, setShowCompletedTasks, todayDateKey, toggleSidebarCollapsed]);

  useEffect(() => {
    const syncSidebarWithViewport = () => {
      if (window.innerWidth < 1024) {
        setSidebarCollapsed(true);
      }
    };
    syncSidebarWithViewport();
    window.addEventListener('resize', syncSidebarWithViewport);
    return () => window.removeEventListener('resize', syncSidebarWithViewport);
  }, []);

  useEffect(() => {
    refreshSession().catch(() => {
      // local-only mode remains available if API/auth are not configured
    });
  }, [refreshSession]);

  useEffect(() => {
    if (!projectMenuId) return;

    const handleClickOutside = () => setProjectMenuId(null);
    document.addEventListener('mousedown', handleClickOutside);

    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [projectMenuId]);

  const handleDeleteProject = useCallback((projectId: string) => {
    const project = projects.find((item) => item.id === projectId);
    const projectName = project?.name || 'this project';
    const directTaskCount = tasks.filter((task) => task.projectId === projectId).length;

    const shouldDeleteProject = window.confirm(`Delete "${projectName}"?`);
    if (!shouldDeleteProject) {
      setProjectMenuId(null);
      return;
    }

    const shouldDeleteTasks = directTaskCount > 0
      ? window.confirm(`Also delete ${directTaskCount} task${directTaskCount === 1 ? '' : 's'} in "${projectName}"? Click OK to delete them, or Cancel to keep them and remove only the project.`)
      : false;

    deleteProject(projectId, shouldDeleteTasks);
    setProjectMenuId(null);
    setAdditionalPanels((prev) => prev.filter((panel) => panel.projectId !== projectId));

    if (selectedProjectId === projectId) {
      navigate(currentView === 'all' ? { view: 'next', projectId: null, dateStr: null } : { projectId: null });
    }
  }, [currentView, deleteProject, navigate, projects, selectedProjectId, tasks]);

  return (
    <div className="app-frame flex h-screen flex-col select-none" style={themeVariables}>
      {showShortcutsModal && <ShortcutsModal onClose={() => setShowShortcutsModal(false)} />}
      {showAccountSyncModal && (
        <AccountSyncModal
          authSession={authSession}
          syncMeta={syncMeta}
          syncStatus={syncStatus}
          onRefreshSession={refreshSession}
          onSignUp={signUp}
          onSignIn={signIn}
          onSignOut={signOut}
          onToggleCloudLinked={setCloudLinked}
          onRunSyncNow={runSyncNow}
          onClose={() => setShowAccountSyncModal(false)}
        />
      )}
      <CommandPalette open={showCommandPalette} commands={commands} resolveQuery={resolveCommandPaletteQuery} onClose={() => setShowCommandPalette(false)} />

      {taskToEditInModal && (
        <TaskModal
          task={tasks.find((task) => task.id === taskToEditInModal.id) || taskToEditInModal}
          tasks={tasks}
          projects={projects}
          onClose={() => setTaskToEditInModal(null)}
          onUpdate={updateTask}
          onSetParent={setTaskParent}
          onDelete={deleteTask}
          onToggleStar={toggleStar}
          onToggleComplete={toggleComplete}
          onMoveTaskBefore={moveTaskBefore}
          onMoveTaskAfter={moveTaskAfter}
          onAddSubtask={(parentTask, title) => addTask(title, parentTask.status === 'completed' ? (parentTask.dueDate ? 'scheduled' : (parentTask.projectId ? 'open' : 'next')) : parentTask.status, parentTask.area, parentTask.projectId, parentTask.dueDate, false, parentTask.id)}
          onOpenTask={setTaskToEditInModal}
        />
      )}

      <header className="topbar-shell z-[100] shrink-0 border-b soft-divider px-3 py-3 lg:flex lg:h-14 lg:items-center lg:justify-between lg:px-5 lg:py-0">
        <div className="flex min-w-0 flex-wrap items-center gap-2 lg:flex-nowrap lg:gap-4">
          <button
            type="button"
            onClick={toggleSidebarCollapsed}
            className="panel-muted flex h-9 w-9 items-center justify-center rounded-xl border soft-divider text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)]"
            title={sidebarCollapsed ? 'Show sidebar (Ctrl/Cmd + B)' : 'Hide sidebar (Ctrl/Cmd + B)'}
            aria-label={sidebarCollapsed ? 'Show sidebar' : 'Hide sidebar'}
          >
            {sidebarCollapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
          </button>
          <div className="min-w-0 items-baseline gap-3 lg:flex">
            <div className="text-[14px] font-bold uppercase tracking-[0.14em] text-[var(--text-primary)]">Too Much Todo</div>
          </div>
          <button
            type="button"
            onClick={() => setShowMobileToolbarMenu((prev) => !prev)}
            className="panel-muted ml-auto flex h-9 w-9 items-center justify-center rounded-xl border soft-divider text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)] lg:hidden"
            title="More controls"
            aria-label="More controls"
          >
            <MoreHorizontal size={16} />
          </button>
          <div className="order-3 flex w-full items-center gap-2 text-[var(--text-muted)] lg:order-none lg:ml-4 lg:w-auto">
            <ChevronLeft
              className={`cursor-pointer ${(currentView === 'planner' || currentView === 'day') ? 'hover:text-[var(--text-primary)]' : 'opacity-20'}`}
              size={14}
              onClick={() => {
                if (currentView === 'planner' && currentWeekOffset > -100) navigate({ weekOffset: currentWeekOffset - 1 });
                else if (currentView === 'day') shiftSelectedDay(-1);
              }}
            />
            <ChevronRight
              className={`cursor-pointer ${(currentView === 'planner' || currentView === 'day') ? 'hover:text-[var(--text-primary)]' : 'opacity-20'}`}
              size={14}
              onClick={() => {
                if (currentView === 'planner' && currentWeekOffset < 100) navigate({ weekOffset: currentWeekOffset + 1 });
                else if (currentView === 'day') shiftSelectedDay(1);
              }}
            />
            {currentWeekOffset !== 0 && currentView === 'planner' && <button type="button" onClick={() => navigate({ weekOffset: 0 })} className="ml-1 text-[10px] font-bold uppercase text-[var(--accent)] hover:underline">Today</button>}
            {currentView === 'day' && <button type="button" onClick={() => navigate({ view: 'day', projectId: null, dateStr: todayDateKey })} className="ml-1 text-[10px] font-bold uppercase text-[var(--accent)] hover:underline">Today</button>}
            {currentView === 'planner' && <span className="ml-2 min-w-0 truncate px-1 text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--text-muted)] lg:ml-3">{weekRangeLabel}</span>}
            {currentView === 'day' && selectedDayLabel && <span className="ml-2 min-w-0 truncate px-1 text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--text-muted)] lg:ml-3">{selectedDayLabel}</span>}
          </div>
          <div className="relative order-4 hidden w-full lg:order-none lg:ml-4 lg:block lg:w-auto">
            <button type="button" onClick={() => setShowAreaMenu((prev) => !prev)} className="panel-muted flex w-full items-center justify-between gap-1 rounded-full border soft-divider px-2.5 py-1 text-[11px] text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)] lg:w-auto lg:justify-start">
              <span className="font-medium">{selectedArea || 'All Areas'}</span>
              <ChevronDown size={14} />
            </button>
            {showAreaMenu && (
              <div className="panel-surface absolute left-0 right-0 top-10 z-50 rounded-2xl py-1 lg:right-auto lg:w-44">
                <button type="button" onClick={() => { setSelectedArea(null); setShowAreaMenu(false); }} className="flex w-full items-center justify-between px-3 py-1.5 text-left text-xs text-[var(--text-primary)] transition-colors hover:bg-[var(--panel-bg)]">All Areas {!selectedArea && <span className="text-[var(--accent)]">•</span>}</button>
                <div className="my-1 border-t soft-divider" />
                {AREAS.map((area) => (
                  <button key={area} type="button" onClick={() => { setSelectedArea(area); setShowAreaMenu(false); }} className="flex w-full items-center justify-between px-3 py-1.5 text-left text-xs text-[var(--text-primary)] transition-colors hover:bg-[var(--panel-bg)]">
                    {area} {selectedArea === area && <span className="text-[var(--accent)]">•</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className={`${showMobileToolbarMenu ? 'mt-3 flex' : 'hidden'} flex-wrap items-center gap-2 lg:mt-0 lg:flex lg:h-full lg:justify-end lg:py-1`}>
          {/* Group 1: Dynamic Mode Options (Width varies by view) */}
          {currentView === 'planner' && (
            <div className="panel-muted flex items-center rounded-xl border soft-divider p-1">
              {plannerWidthOptions.map((option) => {
                const Icon = option.icon;
                const isActive = settings.plannerWidthMode === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setPlannerWidthMode(option.id)}
                    className={`flex h-[30px] items-center gap-1.5 rounded-md px-2 text-[11px] font-medium transition-all lg:px-2.5 ${isActive ? 'bg-[var(--accent-soft)] text-[var(--accent)] shadow-[0_0_0_1px_var(--accent-soft)]' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}
                  >
                    <Icon size={13} />
                    <span className="hidden lg:inline">{option.label}</span>
                  </button>
                );
              })}
            </div>
          )}

          {currentView !== 'planner' && currentView !== 'settings' && currentView !== 'search' && currentView !== 'notes' && (
            <div className="panel-muted flex items-center rounded-xl border soft-divider p-1">
              {(['list', 'outline'] as TaskListMode[]).map((mode) => {
                const Icon = mode === 'list' ? LayoutList : AlignLeft;
                const label = mode.charAt(0).toUpperCase() + mode.slice(1);
                const isActive = settings.taskListMode === mode;
                return (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setTaskListMode(mode)}
                    className={`flex h-[30px] items-center gap-1.5 rounded-md px-2 text-[11px] font-medium transition-all lg:px-2.5 ${isActive ? 'bg-[var(--accent-soft)] text-[var(--accent)] shadow-[0_0_0_1px_var(--accent-soft)]' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}
                  >
                    <Icon size={13} />
                    <span className="hidden lg:inline">{label}</span>
                  </button>
                );
              })}
            </div>
          )}

          {currentView === 'day' && (
            <div className="panel-muted flex items-center rounded-xl border soft-divider p-1">
              <button
                type="button"
                onClick={toggleGroupDayViewByPart}
                className={`flex h-[30px] items-center gap-1.5 rounded-md px-2 text-[11px] font-medium transition-all lg:px-2.5 ${settings.groupDayViewByPart ? 'bg-[var(--accent-soft)] text-[var(--accent)] shadow-[0_0_0_1px_var(--accent-soft)]' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}
              >
                <PanelsTopLeft size={13} />
                <span className="hidden lg:inline">Blocks</span>
              </button>
            </div>
          )}

          <div className="relative w-full lg:hidden">
            <button type="button" onClick={() => setShowAreaMenu((prev) => !prev)} className="panel-muted flex w-full items-center justify-between rounded-xl border soft-divider px-3 py-2 text-[12px] text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]">
              <span className="font-medium">{selectedArea || 'All Areas'}</span>
              <ChevronDown size={14} />
            </button>
            {showAreaMenu && (
              <div className="panel-surface absolute left-0 right-0 top-11 z-50 rounded-2xl py-1">
                <button type="button" onClick={() => { setSelectedArea(null); setShowAreaMenu(false); }} className="flex w-full items-center justify-between px-3 py-1.5 text-left text-xs text-[var(--text-primary)] transition-colors hover:bg-[var(--panel-bg)]">All Areas {!selectedArea && <span className="text-[var(--accent)]">•</span>}</button>
                <div className="my-1 border-t soft-divider" />
                {AREAS.map((area) => (
                  <button key={area} type="button" onClick={() => { setSelectedArea(area); setShowAreaMenu(false); }} className="flex w-full items-center justify-between px-3 py-1.5 text-left text-xs text-[var(--text-primary)] transition-colors hover:bg-[var(--panel-bg)]">
                    {area} {selectedArea === area && <span className="text-[var(--accent)]">•</span>}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="mx-1 hidden h-4 w-px bg-[var(--border-color)] lg:block" />

          {/* Group 2: Static View Toggles */}
          <div className="panel-muted flex items-center rounded-xl border soft-divider p-1">
            <button type="button" onClick={() => handleViewSelect(undefined, 'planner')} className={`flex h-[30px] w-[34px] items-center justify-center rounded-md transition-all ${currentView === 'planner' ? 'bg-[var(--accent-soft)] text-[var(--accent)] shadow-[0_0_0_1px_var(--accent-soft)]' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}>
              <CalendarDays size={16} />
            </button>
            <button type="button" onClick={(e) => handleViewSelect(e, 'next')} className={`flex h-[30px] w-[34px] items-center justify-center rounded-md transition-all ${currentView !== 'planner' && currentView !== 'settings' && currentView !== 'search' && currentView !== 'notes' ? 'bg-[var(--accent-soft)] text-[var(--accent)] shadow-[0_0_0_1px_var(--accent-soft)]' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}>
              <List size={16} />
            </button>
          </div>

          <div className="panel-muted flex items-center rounded-xl border soft-divider p-1">
            <button
              type="button"
              onClick={() => setShowCompletedTasks(!settings.showCompletedTasks)}
              className={`flex h-[30px] w-[34px] items-center justify-center rounded-md transition-all ${settings.showCompletedTasks ? 'bg-[var(--accent-soft)] text-[var(--accent)] shadow-[0_0_0_1px_var(--accent-soft)]' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}
            >
              {settings.showCompletedTasks ? <Eye size={16} /> : <EyeOff size={16} />}
            </button>
          </div>

          <button type="button" onClick={() => setShowShortcutsModal(true)} className="flex h-[30px] w-[34px] items-center justify-center text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)]">
            <Keyboard size={18} />
          </button>
          <button
            type="button"
            onClick={() => setShowAccountSyncModal(true)}
            className={`relative flex h-[30px] w-[34px] items-center justify-center transition-colors ${authSession ? 'text-[var(--text-primary)]' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}
            title="Account & sync"
            aria-label="Open account and sync"
          >
            <Cloud size={18} />
            <span
              className={`absolute right-[3px] top-[3px] h-2 w-2 rounded-full ${syncStatus === 'error'
                ? 'bg-[var(--danger)]'
                : authSession && syncMeta.cloudLinked
                  ? 'bg-[var(--accent)]'
                  : 'bg-[var(--text-muted)]/50'}`}
            />
          </button>

          <div className="mx-1 hidden h-4 w-px bg-[var(--border-color)] lg:block" />

          {/* Group 3: New Task Input (Right-most) */}
          <div className="group panel-muted order-last flex w-full items-center rounded-xl border soft-divider p-1 transition-all focus-within:border-[var(--accent)] focus-within:shadow-[0_0_0_1px_var(--accent-soft)] lg:order-none lg:w-auto">
            <div className="flex h-[30px] items-center pl-2.5">
              <Plus size={14} className="shrink-0 text-[var(--text-muted)] transition-colors group-focus-within:text-[var(--accent)]" />
            </div>
            <form onSubmit={handleAddNewTask} className="min-w-0 flex-1">
              <input
                ref={newTaskInputRef}
                placeholder="New item..."
                className="flex h-[30px] w-full min-w-0 bg-transparent px-2.5 text-[12.5px] font-medium text-[var(--text-primary)] outline-none transition-all placeholder:font-normal placeholder:text-[var(--text-muted)] lg:w-32 lg:focus:w-48"
                value={newTaskTitle}
                onChange={(event) => setNewTaskTitle(event.target.value)}
              />
            </form>
            {!newTaskTitle ? (
              <div className="flex h-[30px] pointer-events-none items-center pr-1 transition-opacity group-focus-within:opacity-0">
                <span className="flex h-5 items-center justify-center rounded border soft-divider bg-[var(--panel-bg)] px-1.5 text-[10px] font-bold text-[var(--text-muted)] shadow-sm">N</span>
              </div>
            ) : (
              <button type="button" onClick={() => handleAddNewTask()} className="mr-0.5 flex h-[26px] items-center rounded-md bg-[var(--accent)] px-2.5 text-[11px] font-bold text-white shadow-sm transition-all hover:brightness-110 active:scale-95">
                Add
              </button>
            )}
          </div>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <aside className={`sidebar-shell shrink-0 overflow-hidden transition-[width,padding,opacity,border-color] duration-200 ${sidebarCollapsed ? 'w-0 border-r-0 px-0 py-0 opacity-0' : 'flex min-h-0 w-72 flex-col overflow-y-auto border-r soft-divider px-4 py-5 opacity-100 [scrollbar-gutter:stable]'}`}>
          <div className="mb-4 px-1">
            <div className="panel-muted flex items-center gap-2 rounded-2xl border soft-divider px-3 py-3">
              <Search size={15} className="text-[var(--text-muted)]" />
              <input
                ref={sidebarSearchRef}
                type="text"
                value={searchQuery}
                onFocus={() => handleViewSelect(undefined, 'search')}
                onChange={(event) => {
                  setSearchQuery(event.target.value);
                  handleViewSelect(undefined, 'search');
                }}
                placeholder="Search tasks..."
                className="w-full bg-transparent text-sm text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)]"
              />
            </div>
          </div>

          <SidebarItem icon={Star} label="Focus" count={counts.focus} active={currentView === 'focus' || additionalPanels.some(p => p.view === 'focus')} onClick={(e) => handleViewSelect(e, 'focus')} onDrop={(id) => updateTask(id, { isStarred: true })} />
          <SidebarItem
            icon={Calendar}
            label="Today"
            count={counts.today}
            active={(currentView === 'day' && selectedPlannerDate === todayDateKey) || additionalPanels.some((p) => p.view === 'day' && p.dateStr === todayDateKey)}
            onClick={(e) => handleViewSelect(e, 'day', null, todayDateKey)}
            onDrop={(id) => updateTask(id, { dueDate: todayDateKey, status: 'scheduled' })}
          />
          <div className="my-4 border-t soft-divider" />
          <SidebarItem icon={Inbox} label="Inbox" count={counts.inbox} active={currentView === 'inbox' || additionalPanels.some(p => p.view === 'inbox')} onClick={(e) => handleViewSelect(e, 'inbox')} onDrop={(id) => updateTask(id, { status: 'inbox' })} />
          <SidebarItem icon={ChevronsRight} label="Next" count={counts.next} active={currentView === 'next' || additionalPanels.some(p => p.view === 'next')} onClick={(e) => handleViewSelect(e, 'next')} onDrop={(id) => updateTask(id, { status: 'next' })} />
          <SidebarItem icon={Clock} label="Waiting" count={counts.waiting} active={currentView === 'waiting' || additionalPanels.some(p => p.view === 'waiting')} onClick={(e) => handleViewSelect(e, 'waiting')} onDrop={(id) => updateTask(id, { status: 'waiting' })} />
          <SidebarItem icon={CalendarClock} label="Scheduled" count={counts.scheduled} active={currentView === 'scheduled' || additionalPanels.some(p => p.view === 'scheduled')} onClick={(e) => handleViewSelect(e, 'scheduled')} onDrop={(id) => updateTask(id, { status: 'scheduled' })} />
          <SidebarItem icon={Coffee} label="Someday" count={counts.someday} active={currentView === 'someday' || additionalPanels.some(p => p.view === 'someday')} onClick={(e) => handleViewSelect(e, 'someday')} onDrop={(id) => updateTask(id, { status: 'someday' })} />
          <div className="my-4 border-t soft-divider" />
          <SidebarItem
            icon={FileText}
            label="Notes"
            count={activeNotes.length}
            active={currentView === 'notes'}
            onClick={() => openNotesDashboard()}
          />

          <div className="my-4">
            <div className="mb-2 flex items-center justify-between px-3">
              <h3 className="section-kicker text-[10px] font-bold uppercase text-[var(--text-muted)]">Projects</h3>
              <button type="button" onClick={() => { const name = prompt('Project Name:'); if (name) addProject(name); }} className="text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)]">
                <Plus size={14} />
              </button>
            </div>
            <div className="space-y-1">
              {projectTree.map(({ project, depth }) => (
                <SidebarItem
                  key={project.id}
                  icon={Folder}
                  label={project.name}
                  count={projectParentTaskCounts.get(project.id) || 0}
                  iconColor={project.color}
                  indent={depth}
                  active={selectedProjectId === project.id || additionalPanels.some(p => p.projectId === project.id)}
                  onClick={(e) => handleViewSelect(e, 'all', project.id)}
                  onDrop={(id) => updateTask(id, { projectId: project.id })}
                  actions={
                    <div className="relative" onMouseDown={(event) => event.stopPropagation()}>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          setProjectMenuId((current) => current === project.id ? null : project.id);
                        }}
                        className={`rounded p-1 text-[var(--text-muted)] opacity-0 transition-all hover:bg-[rgba(255,255,255,0.04)] hover:text-[var(--text-primary)] group-hover:opacity-100 ${projectMenuId === project.id ? 'opacity-100' : ''}`}
                        title="Project actions"
                      >
                        <MoreHorizontal size={12} />
                      </button>

                      {projectMenuId === project.id && (
                        <div
                          className="panel-surface absolute right-0 top-8 z-[80] w-40 rounded-2xl p-2"
                          onClick={(event) => event.stopPropagation()}
                        >
                          <div className="mb-2 px-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--text-muted)]">Project Menu</div>
                          <button
                            type="button"
                            onClick={() => {
                              const name = prompt(`Child project inside "${project.name}":`);
                              if (name) addProject(name, project.id);
                              setProjectMenuId(null);
                            }}
                            className="mb-1 flex w-full items-center gap-2 rounded-xl px-2 py-2 text-left text-[12px] text-[var(--text-primary)] transition-colors hover:bg-[rgba(255,255,255,0.04)]"
                          >
                            <Plus size={12} className="text-[var(--text-muted)]" />
                            <span>Add nested project</span>
                          </button>
                          <div className="my-2 h-px bg-white/5" />
                          <div className="mb-2 px-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--text-muted)]">Folder Color</div>
                          <button
                            type="button"
                            onClick={() => {
                              updateProject(project.id, { color: undefined });
                              setProjectMenuId(null);
                            }}
                            className="mb-2 flex w-full items-center gap-2 rounded-xl px-2 py-2 text-left text-[12px] text-[var(--text-primary)] transition-colors hover:bg-[rgba(255,255,255,0.04)]"
                          >
                            <span className="flex h-4 w-4 items-center justify-center rounded-full border border-[var(--border-color)] bg-[var(--panel-alt-bg)]">
                              <Folder size={10} className="text-[var(--text-muted)]" />
                            </span>
                            <span>Default</span>
                          </button>
                          <div className="grid grid-cols-4 gap-2">
                            {PROJECT_COLORS.map((color) => (
                              <button
                                key={color}
                                type="button"
                                onClick={() => {
                                  updateProject(project.id, { color });
                                  setProjectMenuId(null);
                                }}
                                className={`h-7 rounded-lg border transition-transform hover:scale-[1.05] ${project.color === color ? 'border-white/60' : 'border-white/10'}`}
                                style={{ background: color }}
                                aria-label={`Set project color ${color}`}
                              />
                            ))}
                          </div>
                          <div className="my-2 h-px bg-white/5" />
                          <button
                            type="button"
                            onClick={() => handleDeleteProject(project.id)}
                            className="flex w-full items-center gap-2 rounded-xl px-2 py-2 text-left text-[12px] text-[var(--danger)] transition-colors hover:bg-[var(--danger-soft)]/20"
                          >
                            <Trash2 size={12} />
                            <span>Delete project</span>
                          </button>
                        </div>
                      )}
                    </div>
                  }
                />
              ))}
            </div>
          </div>

          <div className="mt-auto border-t soft-divider pt-4">
            <SidebarItem icon={Settings} label="Settings" active={currentView === 'settings'} onClick={() => { navigate({ view: 'settings', projectId: null, dateStr: null }); collapseSidebarForMobileNavigation(); }} />
          </div>
        </aside>

        <main className="flex-1 relative flex flex-col min-w-0" style={{ paddingRight: 'var(--timer-bar-width, 0px)', transition: 'padding-right 0.4s cubic-bezier(0.16,1,0.3,1)' }}>
          <div className="flex-1 overflow-y-auto px-4 py-5 sm:px-8 sm:py-7">
            {currentView === 'planner' && (
              <PlannerView
                weekDays={weekDays}
                tasks={settings.showCompletedTasks ? tasks : tasks.filter(t => t.status !== 'completed')}
                projects={projects}
                widthMode={settings.plannerWidthMode}
                selectedArea={selectedArea}
                hideEmptyProjects={settings.hideEmptyProjectsInPlanner}
                compactEmptyDays={settings.compactEmptyDaysInPlanner}
                startOnToday={settings.startPlannerOnToday}
                onUpdateTask={updateTask}
                onMoveTaskBefore={moveTaskBeforeFlat}
                onMoveTaskAfter={moveTaskAfterFlat}
                onToggleComplete={toggleComplete}
                onAddTask={(title, dueDate) => addTask(title, dueDate ? 'scheduled' : 'next', selectedArea || 'Personal', null, dueDate || null)}
                onAddProjectTask={(title, projectId) => addTask(title, 'open', selectedArea || 'Personal', projectId, null)}
                onOpenTask={setTaskToEditInModal}
                onOpenProject={(projectId) => { navigate({ view: 'all', projectId, dateStr: null }); collapseSidebarForMobileNavigation(); }}
                onOpenDay={(dateStr) => {
                  navigate({ view: 'day', projectId: null, dateStr });
                  collapseSidebarForMobileNavigation();
                }}
                onToggleHideEmptyProjects={toggleHideEmptyProjectsInPlanner}
                onToggleCompactEmptyDays={toggleCompactEmptyDaysInPlanner}
                onToggleStartOnToday={toggleStartPlannerOnToday}
              />
            )}

            {currentView === 'settings' && (
              <SettingsView
                projects={projects}
                themes={themes}
                activeThemeId={settings.activeThemeId}
                onSetActiveTheme={setActiveTheme}
                onExportData={() => downloadJson(`too-much-to-do-export-${new Date().toISOString().slice(0, 10)}.json`, createExportPayload({ version: 1, tasks, projects, notes, settings, themes, timer }))}
                onImportData={(payload) => {
                  if (!isAppExport(payload)) return;
                  importAppData(payload);
                }}
                onExportTaskListJson={(scope: TaskListScope) => {
                  const payload = createTaskListExchangePayload(tasks, projects, scope);
                  const scopeName = scope.type === 'inbox' ? 'inbox' : scope.projectId;
                  downloadJson(`too-much-to-do-${scopeName}-list-${new Date().toISOString().slice(0, 10)}.json`, payload);
                }}
                onImportTaskListJson={(payload, mode: TaskListImportMode) => {
                  if (!isTaskListExchange(payload)) return;
                  importTaskListData(payload, mode);
                }}
                onExportTaskListMarkdown={(scope: TaskListScope) => {
                  const markdown = createTaskListMarkdown(tasks, projects, scope);
                  const scopeName = scope.type === 'inbox' ? 'inbox' : scope.projectId;
                  const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
                  const url = URL.createObjectURL(blob);
                  const link = document.createElement('a');
                  link.href = url;
                  link.download = `too-much-to-do-${scopeName}-list-${new Date().toISOString().slice(0, 10)}.md`;
                  link.click();
                  URL.revokeObjectURL(url);
                }}
                onCopyTaskListProgressPrompt={async (scope: TaskListScope) => {
                  const prompt = createTaskListProgressPrompt(tasks, projects, scope);
                  return copyTextToClipboard(prompt);
                }}
                onSaveTheme={saveTheme}
                authSession={authSession}
                syncMeta={syncMeta}
                syncStatus={syncStatus}
                onRefreshSession={refreshSession}
                onSignUp={signUp}
                onSignIn={signIn}
                onSignOut={signOut}
                onToggleCloudLinked={setCloudLinked}
                onRunSyncNow={runSyncNow}
              />
            )}

            {currentView === 'search' && (
              <SearchView query={searchQuery} tasks={searchResults} projects={projects} onOpenTask={setTaskToEditInModal} />
            )}

            {currentView === 'notes' && (
              <NotesDashboardView
                notes={activeNotes}
                projects={projects}
                focusState={notesViewFocus}
                onAddNote={addNote}
                onUpdateNote={updateNote}
                onDeleteNote={deleteNote}
                onTogglePinned={toggleNotePinned}
              />
            )}

            {currentView !== 'planner' && currentView !== 'settings' && currentView !== 'search' && currentView !== 'notes' && (
              <>
                {additionalPanels.length === 0 ? (
                  <TaskPanelWrapper
                    panel={{ id: 'main', view: currentView, projectId: selectedProjectId, dateStr: selectedPlannerDate }}
                    tasks={tasks}
                    projects={projects}
                    notes={activeNotes}
                    settings={settings}
                    themeVariables={themeVariables}
                    selectedArea={selectedArea}
                    expandedTaskId={expandedTaskId}
                    setExpandedTaskId={setExpandedTaskId}
                    addTask={addTask}
                    addNote={addNote}
                    setTaskListMode={setTaskListMode}
                    toggleStar={toggleStar}
                    toggleComplete={toggleComplete}
                    updateTask={updateTask}
                    reorderTasks={reorderTasks}
                    moveTaskBefore={moveTaskBefore}
                    moveTaskAfter={moveTaskAfter}
                    toggleTaskCollapsed={toggleTaskCollapsed}
                    deleteTask={deleteTask}
                    updateNote={updateNote}
                    deleteNote={deleteNote}
                    toggleNotePinned={toggleNotePinned}
                    setTaskToEditInModal={setTaskToEditInModal}
                    onOpenNotes={openNotesDashboard}
                    onOpenDate={(dateStr) => handleViewSelect(undefined, 'day', null, dateStr)}
                    onBack={currentView === 'day' ? () => handleViewSelect(undefined, 'planner') : undefined}
                    isSingle={true}
                  />
                ) : (
                  <div className="flex w-full h-full gap-4 overflow-x-auto pb-4" style={{ paddingRight: '20px' }}>
                    <TaskPanelWrapper
                      panel={{ id: 'main', view: currentView, projectId: selectedProjectId, dateStr: selectedPlannerDate }}
                      tasks={tasks}
                      projects={projects}
                      notes={activeNotes}
                      settings={settings}
                      themeVariables={themeVariables}
                      selectedArea={selectedArea}
                      expandedTaskId={expandedTaskId}
                      setExpandedTaskId={setExpandedTaskId}
                      addTask={addTask}
                      addNote={addNote}
                      setTaskListMode={setTaskListMode}
                      toggleStar={toggleStar}
                      toggleComplete={toggleComplete}
                      updateTask={updateTask}
                      reorderTasks={reorderTasks}
                      moveTaskBefore={moveTaskBefore}
                      moveTaskAfter={moveTaskAfter}
                      toggleTaskCollapsed={toggleTaskCollapsed}
                      deleteTask={deleteTask}
                      updateNote={updateNote}
                      deleteNote={deleteNote}
                      toggleNotePinned={toggleNotePinned}
                      setTaskToEditInModal={setTaskToEditInModal}
                      onOpenNotes={openNotesDashboard}
                    />
                    {additionalPanels.map((panel) => (
                      <TaskPanelWrapper
                        key={panel.id}
                        panel={panel}
                        tasks={tasks}
                        projects={projects}
                        notes={activeNotes}
                        settings={settings}
                        themeVariables={themeVariables}
                        selectedArea={selectedArea}
                        expandedTaskId={expandedTaskId}
                        setExpandedTaskId={setExpandedTaskId}
                        addTask={addTask}
                        addNote={addNote}
                        setTaskListMode={setTaskListMode}
                        toggleStar={toggleStar}
                        toggleComplete={toggleComplete}
                        updateTask={updateTask}
                        reorderTasks={reorderTasks}
                        moveTaskBefore={moveTaskBefore}
                        moveTaskAfter={moveTaskAfter}
                        toggleTaskCollapsed={toggleTaskCollapsed}
                        deleteTask={deleteTask}
                        updateNote={updateNote}
                        deleteNote={deleteNote}
                        toggleNotePinned={toggleNotePinned}
                        setTaskToEditInModal={setTaskToEditInModal}
                        onOpenNotes={openNotesDashboard}
                        onClose={() => setAdditionalPanels((prev) => prev.filter((p) => p.id !== panel.id))}
                      />
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
          <GlobalTimerOverlay />
        </main>
      </div>

      <GlobalTimerTrigger />
    </div>
  );
}
