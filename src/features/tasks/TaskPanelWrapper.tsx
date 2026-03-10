import React, { useMemo } from 'react';
import { FileText, PictureInPicture2 } from 'lucide-react';
import { Project, Task, TaskListMode, AppView, Note, NoteScopeType } from '../../types';
import { TaskListView } from './TaskListView';
import {
  TaskPanelPictureInPictureBridge,
  TaskPanelPictureInPictureBridgeHandle,
} from './TaskPanelPictureInPictureBridge';
import { getProjectSubtreeIds } from '../../lib/projectTree';
import { collectTaskIdsWithAncestors, getTaskDescendantIds } from './taskTree';
import { matchesScope } from '../notes/noteUtils';

export interface PanelState {
  id: string;
  view: AppView;
  projectId: string | null;
  dateStr: string | null;
}

export const TaskPanelWrapper: React.FC<{
  panel: PanelState;
  tasks: Task[];
  projects: Project[];
  notes: Note[];
  settings: { taskListMode: TaskListMode;[key: string]: any };
  themeVariables: Record<string, string>;
  selectedArea: string | null;
  expandedTaskId: string | null;
  setExpandedTaskId: (id: string | null) => void;
  addTask: (title: string, status: string, area: string, projectId: string | null, dueDate: string | null, forceLast?: boolean, parentId?: string | null, dayPart?: 'morning' | 'afternoon' | 'evening' | null) => Task;
  setTaskListMode: (mode: TaskListMode) => void;
  toggleStar: (id: string) => void;
  toggleComplete: (id: string) => void;
  updateTask: (id: string, updates: Partial<Task>) => void;
  reorderTasks: (sourceId: string, targetId: string) => void;
  moveTaskBefore: (sourceId: string, targetId: string, parentId: string | null) => void;
  moveTaskAfter: (sourceId: string, targetId: string, parentId: string | null) => void;
  toggleTaskCollapsed: (id: string) => void;
  deleteTask: (id: string) => void;
  setTaskToEditInModal: (task: Task | null) => void;
  onOpenNotes: (scopeType: NoteScopeType | 'all', scopeRef: string | null) => void;
  onOpenDate?: (dateStr: string) => void;
  onBack?: () => void;
  onClose?: () => void;
  isSingle?: boolean;
}> = ({
  panel,
  tasks,
  projects,
  notes,
  settings,
  themeVariables,
  selectedArea,
  expandedTaskId,
  setExpandedTaskId,
  addTask,
  setTaskListMode,
  toggleStar,
  toggleComplete,
  updateTask,
  reorderTasks,
  moveTaskBefore,
  moveTaskAfter,
  toggleTaskCollapsed,
  deleteTask,
  setTaskToEditInModal,
  onOpenNotes,
  onOpenDate,
  onBack,
  onClose,
  isSingle,
}) => {
    const [isPictureInPictureOpen, setIsPictureInPictureOpen] = React.useState(false);
    const pictureInPictureBridgeRef = React.useRef<TaskPanelPictureInPictureBridgeHandle>(null);
    const isPictureInPictureSupported = typeof window !== 'undefined' && Boolean(window.documentPictureInPicture);
    const todayDateStr = new Date().toISOString().slice(0, 10);
    const isDayLikeView = panel.view === 'day' || panel.view === 'today';

    const filteredTasks = useMemo(() => {
      let result = tasks;
      if (selectedArea) result = result.filter((task) => task.area === selectedArea);
      if (panel.view === 'focus') result = result.filter((task) => task.isStarred && task.status !== 'completed');
      else if (panel.view === 'today') result = result.filter((task) => task.dueDate === todayDateStr);
      else if (panel.view === 'day') result = result.filter((task) => task.dueDate === panel.dateStr);
      else if (panel.view === 'scheduled') result = result.filter((task) => task.status === 'scheduled' || (task.status === 'completed' && task.dueDate));
      else if (panel.view !== 'all' && panel.view !== 'planner' && panel.view !== 'settings' && panel.view !== 'search') {
        result = result.filter((task) => task.status === panel.view);
      }
      if (panel.projectId) {
        const projectIds = getProjectSubtreeIds(panel.projectId, projects);
        result = result.filter((task) => task.projectId && projectIds.has(task.projectId));
      }
      if (!settings.showCompletedTasks && panel.view !== 'completed') {
        result = result.filter((task) => task.status !== 'completed');
      }
      return result;
    }, [tasks, panel.view, panel.dateStr, panel.projectId, projects, selectedArea, settings.showCompletedTasks, todayDateStr]);

    const matchedTaskIds = useMemo(() => new Set(filteredTasks.map((task) => task.id)), [filteredTasks]);

    const taskListTasks = useMemo(() => {
      if (settings.taskListMode !== 'outline') return filteredTasks;
      const matchedIds = filteredTasks.map((task) => task.id);
      const contextIds = collectTaskIdsWithAncestors(matchedIds, tasks);
      for (const taskId of matchedIds) {
        for (const descendantId of getTaskDescendantIds(taskId, tasks)) {
          contextIds.add(descendantId);
        }
      }
      return tasks.filter((task) => contextIds.has(task.id));
    }, [filteredTasks, settings.taskListMode, tasks]);

    const selectedPlannerDay = useMemo(() => {
      if (!panel.dateStr) return null;
      const date = new Date(`${panel.dateStr}T00:00:00`);
      return {
        title: date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }),
        subtitle: date.toLocaleDateString('en-US', { year: 'numeric' }),
      };
    }, [panel.dateStr]);

    const visibleNotes = useMemo(() => notes.filter((note) => note.deletedAt === null), [notes]);
    const scopedNoteCount = useMemo(() => {
      if (panel.projectId) return visibleNotes.filter((note) => matchesScope(note, 'project', panel.projectId)).length;
      if ((panel.view === 'day' || panel.view === 'today') && (panel.dateStr || todayDateStr)) {
        const ref = panel.view === 'today' ? todayDateStr : panel.dateStr!;
        return visibleNotes.filter((note) => matchesScope(note, 'day', ref)).length;
      }
      if (selectedArea) return visibleNotes.filter((note) => matchesScope(note, 'area', selectedArea)).length;
      return null;
    }, [panel.projectId, panel.view, panel.dateStr, selectedArea, todayDateStr, visibleNotes]);

    const scopedNotesLink = useMemo(() => {
      if (panel.projectId) return { scopeType: 'project' as const, scopeRef: panel.projectId };
      if ((panel.view === 'day' || panel.view === 'today') && (panel.dateStr || todayDateStr)) {
        return { scopeType: 'day' as const, scopeRef: panel.view === 'today' ? todayDateStr : panel.dateStr! };
      }
      if (selectedArea) return { scopeType: 'area' as const, scopeRef: selectedArea };
      return null;
    }, [panel.projectId, panel.view, panel.dateStr, selectedArea, todayDateStr]);

    const headerTitle = useMemo(() => {
      if (panel.projectId) return projects.find((project) => project.id === panel.projectId)?.name || 'Project';
      if (panel.view === 'day' && selectedPlannerDay) return `${selectedPlannerDay.title}, ${selectedPlannerDay.subtitle}`;
      if (selectedArea) return selectedArea;
      switch (panel.view) {
        case 'inbox': return 'Inbox';
        case 'focus': return 'Focus';
        case 'today': return 'Today';
        case 'next': return 'Next';
        case 'waiting': return 'Waiting';
        case 'scheduled': return 'Scheduled';
        case 'someday': return 'Someday';
        case 'completed': return 'Completed';
        case 'day': return 'Day';
        default: return 'All Tasks';
      }
    }, [panel.view, projects, selectedArea, selectedPlannerDay, panel.projectId]);

    const child = (
      <div>
        <TaskListView
          tasks={taskListTasks}
          allTasks={tasks}
          projects={projects}
          headerTitle={headerTitle}
          currentView={panel.view === 'today' ? 'day' : panel.view}
          selectedArea={selectedArea}
          selectedProjectId={panel.projectId}
          expandedTaskId={expandedTaskId}
          itemCount={filteredTasks.length}
          matchedTaskIds={matchedTaskIds}
          taskListMode={settings.taskListMode}
          groupDayViewByPart={Boolean(settings.groupDayViewByPart)}
          backLabel={panel.view === 'day' ? 'Back to week' : undefined}
          onExpandTask={setExpandedTaskId}
          onAddTask={(title, dayPart) => addTask(title, isDayLikeView ? 'scheduled' : (panel.projectId && panel.view === 'all') ? 'open' : (panel.view === 'all' || panel.view === 'focus' || panel.view === 'planner') ? 'next' : panel.view as any, selectedArea || 'Personal', panel.projectId, isDayLikeView ? (panel.view === 'today' ? todayDateStr : panel.dateStr) : null, false, null, isDayLikeView ? (dayPart ?? null) : null)}
          onAddSubtask={(parentTask, title) => addTask(title, parentTask.status === 'completed' ? (parentTask.dueDate ? 'scheduled' : (parentTask.projectId ? 'open' : 'next')) : parentTask.status, parentTask.area, parentTask.projectId, parentTask.dueDate, false, parentTask.id, parentTask.dayPart)}
          onTaskListModeChange={setTaskListMode}
          onToggleStar={toggleStar}
          onToggleComplete={toggleComplete}
          onUpdateTask={updateTask}
          onReorderTasks={reorderTasks}
          onMoveTaskBefore={moveTaskBefore}
          onMoveTaskAfter={moveTaskAfter}
          onToggleTaskCollapsed={toggleTaskCollapsed}
          onDeleteTask={deleteTask}
          onOpenTask={setTaskToEditInModal as any}
          onOpenDate={onOpenDate}
          onBack={onBack}
        />
      </div>
    );

    const handleTogglePictureInPicture = async () => {
      if (!isPictureInPictureSupported) return;
      if (isPictureInPictureOpen) {
        pictureInPictureBridgeRef.current?.close();
        return;
      }
      await pictureInPictureBridgeRef.current?.open();
    };

    const pictureInPicturePlaceholder = (
      <div className="flex min-h-[360px] items-center justify-center px-6">
        <div className="panel-surface max-w-sm rounded-[28px] px-6 py-7 text-center">
          <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--accent)]">Always On Top</div>
          <h2 className="mt-3 text-[22px] font-medium tracking-[-0.04em] text-[var(--text-primary)]">{headerTitle}</h2>
          <p className="mt-2 text-[12px] leading-6 text-[var(--text-secondary)]">
            This list is live in its Picture-in-Picture window. Changes still sync with the main app instantly.
          </p>
          <button
            type="button"
            onClick={handleTogglePictureInPicture}
            className="mt-5 inline-flex items-center gap-2 rounded-full bg-[var(--accent)] px-4 py-2 text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--accent-contrast)] transition-transform hover:scale-[1.02]"
          >
            Return To Panel
          </button>
        </div>
      </div>
    );

    const notesLinkButton = scopedNotesLink && (
      <button
        type="button"
        onClick={() => onOpenNotes(scopedNotesLink.scopeType, scopedNotesLink.scopeRef)}
        className="inline-flex h-9 items-center justify-center gap-1.5 rounded-full border soft-divider panel-muted px-3 transition-colors text-[var(--text-muted)] hover:text-[var(--text-primary)]"
        title="Open notes for this context"
      >
        <FileText className="h-3.5 w-3.5" strokeWidth={1.8} aria-hidden="true" />
        <span className="text-[10px] font-bold uppercase tracking-[0.14em]">
          Notes{scopedNoteCount !== null && scopedNoteCount > 0 ? ` (${scopedNoteCount})` : ''}
        </span>
      </button>
    );

    const popOutAction = (
      <button
        type="button"
        onClick={handleTogglePictureInPicture}
        disabled={!isPictureInPictureSupported}
        className={`inline-flex h-9 items-center justify-center gap-2 rounded-full border soft-divider panel-muted px-3 transition-colors ${isPictureInPictureSupported ? 'text-[var(--text-muted)] hover:text-[var(--text-primary)]' : 'cursor-not-allowed opacity-40'}`}
        title={isPictureInPictureSupported ? (isPictureInPictureOpen ? 'Return task panel from always-on-top window' : 'Open task panel in always-on-top window') : 'Always-on-top view is not supported in this browser'}
        aria-label={isPictureInPictureOpen ? 'Return task panel from always-on-top window' : 'Open task panel in always-on-top window'}
      >
        <PictureInPicture2 className="h-4 w-4" strokeWidth={1.8} aria-hidden="true" />
        <span className="text-[10px] font-bold uppercase tracking-[0.14em]">
          {isPictureInPictureSupported ? 'Pop Out' : 'No PiP'}
        </span>
      </button>
    );

    const panelActions = (
      <div className="absolute top-0 right-0 z-20 flex items-center gap-2">
        {notesLinkButton}
        {popOutAction}
        {onClose && (
          <button
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border soft-divider panel-muted text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
            title="Close Panel"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
    );

    const body = isPictureInPictureOpen ? pictureInPicturePlaceholder : child;

    if (isSingle) {
      return (
        <>
          <TaskPanelPictureInPictureBridge
            ref={pictureInPictureBridgeRef}
            title={`${headerTitle} • Too Much Todo`}
            themeVariables={themeVariables}
            onOpenChange={setIsPictureInPictureOpen}
          >
            {child}
          </TaskPanelPictureInPictureBridge>
          <div className="relative">
            {panelActions}
            {body}
          </div>
        </>
      );
    }

    return (
      <>
        <TaskPanelPictureInPictureBridge
          ref={pictureInPictureBridgeRef}
          title={`${headerTitle} • Too Much Todo`}
          themeVariables={themeVariables}
          onOpenChange={setIsPictureInPictureOpen}
        >
          {child}
        </TaskPanelPictureInPictureBridge>
        <div className="relative h-full flex flex-col flex-1 shrink-0 min-w-[320px] max-w-[800px] border-r soft-divider pr-8 overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
          {panelActions}
          {body}
        </div>
      </>
    );
  };
