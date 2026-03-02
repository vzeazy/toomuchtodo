import React, { useMemo } from 'react';
import { Project, Task, TaskListMode, AppView } from '../../types';
import { TaskListView } from './TaskListView';
import { collectTaskIdsWithAncestors, getTaskDescendantIds } from './taskTree';

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
  settings: { taskListMode: TaskListMode;[key: string]: any };
  selectedArea: string | null;
  expandedTaskId: string | null;
  setExpandedTaskId: (id: string | null) => void;
  addTask: (title: string, status: string, area: string, projectId: string | null, dueDate: string | null, forceLast?: boolean, parentId?: string | null) => void;
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
  onOpenDate?: (dateStr: string) => void;
  onBack?: () => void;
  onClose?: () => void;
  isSingle?: boolean;
}> = ({
  panel,
  tasks,
  projects,
  settings,
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
  onOpenDate,
  onBack,
  onClose,
  isSingle,
}) => {
    const filteredTasks = useMemo(() => {
      let result = tasks;
      if (selectedArea) result = result.filter((task) => task.area === selectedArea);
      if (panel.view === 'focus') result = result.filter((task) => task.isStarred && task.status !== 'completed');
      else if (panel.view === 'today') result = result.filter((task) => task.dueDate === new Date().toISOString().slice(0, 10));
      else if (panel.view === 'day') result = result.filter((task) => task.dueDate === panel.dateStr);
      else if (panel.view === 'scheduled') result = result.filter((task) => task.status === 'scheduled' || (task.status === 'completed' && task.dueDate));
      else if (panel.view !== 'all' && panel.view !== 'planner' && panel.view !== 'settings' && panel.view !== 'search') {
        result = result.filter((task) => task.status === panel.view);
      }
      if (panel.projectId) result = result.filter((task) => task.projectId === panel.projectId);
      if (!settings.showCompletedTasks && panel.view !== 'completed') {
        result = result.filter((task) => task.status !== 'completed');
      }
      return result;
    }, [tasks, panel.view, panel.dateStr, panel.projectId, selectedArea, settings.showCompletedTasks]);

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
      <TaskListView
        tasks={taskListTasks}
        allTasks={tasks}
        projects={projects}
        headerTitle={headerTitle}
        currentView={panel.view}
        selectedArea={selectedArea}
        selectedProjectId={panel.projectId}
        expandedTaskId={expandedTaskId}
        itemCount={filteredTasks.length}
        matchedTaskIds={matchedTaskIds}
        taskListMode={settings.taskListMode}
        backLabel={panel.view === 'day' ? 'Back to week' : undefined}
        onExpandTask={setExpandedTaskId}
        onAddTask={(title) => addTask(title, panel.view === 'day' ? 'scheduled' : (panel.view === 'all' || panel.view === 'focus' || panel.view === 'planner') ? 'next' : panel.view as any, selectedArea || 'Personal', panel.projectId, panel.view === 'day' ? panel.dateStr : null)}
        onAddSubtask={(parentTask, title) => addTask(title, parentTask.status === 'completed' ? (parentTask.dueDate ? 'scheduled' : 'next') : parentTask.status, parentTask.area, parentTask.projectId, parentTask.dueDate, false, parentTask.id)}
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
    );

    if (isSingle) {
      return child;
    }

    return (
      <div className="relative h-full flex flex-col flex-1 shrink-0 min-w-[320px] max-w-[800px] border-r soft-divider pr-8 overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
        {onClose && (
          <button
            onClick={onClose}
            className="absolute right-0 top-0 p-2 text-[var(--text-muted)] hover:text-[var(--text-primary)] z-10 transition-colors"
            title="Close Panel"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        )}
        {child}
      </div>
    );
  };
