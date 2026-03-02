import React, { useMemo, useState } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { GhostItem } from '../../components/GhostItem';
import { Project, Task, TaskListMode } from '../../types';
import { OutlineTaskRow } from './OutlineTaskRow';
import { TaskRow } from './TaskRow';
import { buildVisibleTaskTree, canReparentTask } from './taskTree';

export const TaskListView: React.FC<{
  tasks: Task[];
  allTasks: Task[];
  projects: Project[];
  headerTitle: string;
  currentView: string;
  selectedArea: string | null;
  selectedProjectId: string | null;
  expandedTaskId: string | null;
  itemCount: number;
  matchedTaskIds: Set<string>;
  taskListMode: TaskListMode;
  backLabel?: string;
  onExpandTask: (id: string | null) => void;
  onAddTask: (title: string) => void;
  onAddSubtask: (parentTask: Task, title: string) => void;
  onTaskListModeChange: (mode: TaskListMode) => void;
  onToggleStar: (id: string) => void;
  onToggleComplete: (id: string) => void;
  onUpdateTask: (id: string, updates: Partial<Task>) => void;
  onReorderTasks: (sourceId: string, targetId: string) => void;
  onMoveTaskBefore: (sourceId: string, targetId: string, parentId: string | null) => void;
  onMoveTaskAfter: (sourceId: string, targetId: string, parentId: string | null) => void;
  onToggleTaskCollapsed: (id: string) => void;
  onDeleteTask: (id: string) => void;
  onOpenTask: (task: Task) => void;
  onOpenDate?: (dateStr: string) => void;
  onBack?: () => void;
}> = ({
  tasks,
  allTasks,
  projects,
  headerTitle,
  currentView,
  selectedArea,
  selectedProjectId,
  expandedTaskId,
  itemCount,
  matchedTaskIds,
  taskListMode,
  backLabel,
  onExpandTask,
  onAddTask,
  onAddSubtask,
  onTaskListModeChange,
  onToggleStar,
  onToggleComplete,
  onUpdateTask,
  onReorderTasks,
  onMoveTaskBefore,
  onMoveTaskAfter,
  onToggleTaskCollapsed,
  onDeleteTask,
  onOpenTask,
  onOpenDate,
  onBack,
}) => {
    const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
    const lastParentIdForGhost = React.useRef<string | null>(null);

    const listTasks = useMemo(() => {
      return [...tasks].sort((left, right) => {
        if (left.isStarred === right.isStarred) return 0;
        return left.isStarred ? -1 : 1;
      });
    }, [tasks]);
    const topLevelListTasks = useMemo(() => listTasks.filter((task) => !task.parentId), [listTasks]);

    const childCounts = useMemo(() => {
      const counts = new Map<string, number>();
      for (const task of allTasks) {
        if (!task.parentId) continue;
        counts.set(task.parentId, (counts.get(task.parentId) || 0) + 1);
      }
      return counts;
    }, [allTasks]);

    const outlineRows = useMemo(() => buildVisibleTaskTree(tasks, matchedTaskIds), [matchedTaskIds, tasks]);
    const isScheduledView = currentView === 'scheduled';

    const scheduledListGroups = useMemo(() => {
      if (!isScheduledView || taskListMode !== 'list') return [];

      const groups = new Map<string, Task[]>();
      for (const task of topLevelListTasks) {
        const key = task.dueDate || 'unscheduled';
        const existing = groups.get(key) || [];
        existing.push(task);
        groups.set(key, existing);
      }

      return Array.from(groups.entries()).map(([dateKey, items]) => ({
        dateKey,
        items,
        label: formatScheduledGroupLabel(dateKey),
      }));
    }, [isScheduledView, topLevelListTasks, taskListMode]);

    const scheduledOutlineGroups = useMemo(() => {
      if (!isScheduledView || taskListMode !== 'outline') return [];

      const groups = new Map<string, typeof outlineRows>();
      for (const row of outlineRows) {
        const key = row.task.dueDate || 'unscheduled';
        const existing = groups.get(key) || [];
        existing.push(row);
        groups.set(key, existing);
      }

      return Array.from(groups.entries()).map(([dateKey, rows]) => ({
        dateKey,
        rows,
        label: formatScheduledGroupLabel(dateKey),
      }));
    }, [isScheduledView, outlineRows, taskListMode]);

    const canIndentTask = (taskId: string) => {
      const index = outlineRows.findIndex((row) => row.task.id === taskId);
      if (index <= 0) return false;
      return canReparentTask(taskId, outlineRows[index - 1].task.id, allTasks);
    };

    const canOutdentTask = (taskId: string) => {
      const task = allTasks.find((item) => item.id === taskId);
      return Boolean(task?.parentId);
    };

    const canMoveTaskUp = (taskId: string) => {
      const task = allTasks.find((item) => item.id === taskId);
      if (!task) return false;
      const siblings = allTasks.filter((item) => item.parentId === task.parentId);
      return siblings.findIndex((item) => item.id === taskId) > 0;
    };

    const canMoveTaskDown = (taskId: string) => {
      const task = allTasks.find((item) => item.id === taskId);
      if (!task) return false;
      const siblings = allTasks.filter((item) => item.parentId === task.parentId);
      const index = siblings.findIndex((item) => item.id === taskId);
      return index !== -1 && index < siblings.length - 1;
    };

    const handleIndentTask = (taskId: string) => {
      const index = outlineRows.findIndex((row) => row.task.id === taskId);
      if (index <= 0) return;
      const previousRow = outlineRows[index - 1];
      if (!canReparentTask(taskId, previousRow.task.id, allTasks)) return;
      onMoveTaskAfter(taskId, previousRow.task.id, previousRow.task.id);
    };

    const handleOutdentTask = (taskId: string) => {
      const task = allTasks.find((item) => item.id === taskId);
      if (!task?.parentId) return;
      const parentTask = allTasks.find((item) => item.id === task.parentId);
      if (!parentTask) return;
      onMoveTaskAfter(taskId, parentTask.id, parentTask.parentId);
    };

    const handleMoveTaskUp = (taskId: string) => {
      const task = allTasks.find((item) => item.id === taskId);
      if (!task) return;
      const siblings = allTasks.filter((item) => item.parentId === task.parentId);
      const index = siblings.findIndex((item) => item.id === taskId);
      if (index <= 0) return;
      onMoveTaskBefore(taskId, siblings[index - 1].id, task.parentId);
    };

    const handleMoveTaskDown = (taskId: string) => {
      const task = allTasks.find((item) => item.id === taskId);
      if (!task) return;
      const siblings = allTasks.filter((item) => item.parentId === task.parentId);
      const index = siblings.findIndex((item) => item.id === taskId);
      if (index === -1 || index >= siblings.length - 1) return;
      onMoveTaskAfter(taskId, siblings[index + 1].id, task.parentId);
    };

    const handleMoveTaskBeforeList = (sourceId: string, targetId: string) => {
      const targetTask = allTasks.find((item) => item.id === targetId);
      if (!targetTask) return;
      onMoveTaskBefore(sourceId, targetId, targetTask.parentId);
    };

    const handleMoveTaskAfterList = (sourceId: string, targetId: string) => {
      const targetTask = allTasks.find((item) => item.id === targetId);
      if (!targetTask) return;
      onMoveTaskAfter(sourceId, targetId, targetTask.parentId);
    };

    const handleNestTaskList = (sourceId: string, targetId: string) => {
      if (!canReparentTask(sourceId, targetId, allTasks)) return;
      onMoveTaskAfter(sourceId, targetId, targetId);
    };

    const toggleGroupCollapsed = (dateKey: string) => {
      setCollapsedGroups((prev) => {
        const next = new Set(prev);
        if (next.has(dateKey)) next.delete(dateKey);
        else next.add(dateKey);
        return next;
      });
    };

    const handleAddTask = (title: string, indentMode?: 'indent' | 'none') => {
      if (indentMode === 'indent') {
        let parentTask: Task | undefined;

        // Try to stick to the same parent if we've been adding subtasks consecutively
        if (lastParentIdForGhost.current) {
          parentTask = allTasks.find(t => t.id === lastParentIdForGhost.current);
        }

        if (!parentTask) {
          if (taskListMode === 'outline') {
            parentTask = outlineRows.length > 0 ? outlineRows[outlineRows.length - 1]?.task : undefined;
          } else {
            parentTask = topLevelListTasks.length > 0 ? topLevelListTasks[topLevelListTasks.length - 1] : undefined;
          }
        }

        if (parentTask) {
          lastParentIdForGhost.current = parentTask.id;
          onAddSubtask(parentTask, title);
          return;
        }
      }

      // Reset if we are adding a top-level task
      lastParentIdForGhost.current = null;
      onAddTask(title);
    };

    return (
      <div className="mx-auto max-w-5xl">
        <div className="mb-8">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="mb-3 inline-flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.12em] text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)]"
            >
              <ChevronLeft size={14} />
              {backLabel || 'Back'}
            </button>
          )}
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-[26px] font-medium leading-[1.05] tracking-[-0.03em] text-[var(--text-primary)]">{headerTitle}</h1>
              <div className="mt-2 text-[11px] font-medium text-[var(--text-muted)]">
                {(taskListMode === 'list' ? topLevelListTasks.length : itemCount)} items
                {selectedArea && <span className="ml-3">Area: {selectedArea}</span>}
                {selectedProjectId && <span className="ml-3">Project scoped</span>}
              </div>
            </div>

          </div>
        </div>

        <div className="minimal-surface overflow-visible">
          {isScheduledView && taskListMode === 'list' ? (
            <>
              {scheduledListGroups.map((group, index) => {
                const isCollapsed = collapsedGroups.has(group.dateKey);
                return (
                  <section
                    key={group.dateKey}
                    className={`mb-4 transition-opacity duration-200 ${index < 3 ? 'opacity-100' : 'opacity-45 hover:opacity-100 focus-within:opacity-100'}`}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        if (onOpenDate && group.dateKey !== 'unscheduled') onOpenDate(group.dateKey);
                        else toggleGroupCollapsed(group.dateKey);
                      }}
                      className="mb-2 flex w-full items-center justify-between px-0 py-2 text-left transition-opacity hover:opacity-100"
                    >
                      <div className="text-[14px] font-medium tracking-[-0.02em] text-[var(--text-primary)]">{group.label}</div>
                      <div className="flex items-center gap-3 text-[var(--text-muted)]">
                        <span className="text-[10px] font-bold uppercase tracking-[0.16em]">{group.items.length}</span>
                        {isCollapsed ? <ChevronRight size={15} /> : <ChevronDown size={15} />}
                      </div>
                    </button>

                    {!isCollapsed && group.items.map((task) => (
                      <TaskRow
                        key={task.id}
                        task={task}
                        projects={projects}
                        childCount={childCounts.get(task.id) || 0}
                        onToggleStar={onToggleStar}
                        onToggleComplete={onToggleComplete}
                        onUpdate={onUpdateTask}
                        onMoveBefore={handleMoveTaskBeforeList}
                        onMoveAfter={handleMoveTaskAfterList}
                        onNestInto={handleNestTaskList}
                        onDelete={onDeleteTask}
                        onOpenTask={onOpenTask}
                        canNestTask={(sourceId, targetId) => canReparentTask(sourceId, targetId, allTasks)}
                        allTasks={allTasks}
                        onAddSubtask={onAddSubtask}
                      />
                    ))}
                  </section>
                );
              })}
            </>
          ) : isScheduledView && taskListMode === 'outline' ? (
            <>
              {scheduledOutlineGroups.map((group, index) => {
                const isCollapsed = collapsedGroups.has(group.dateKey);
                return (
                  <section
                    key={group.dateKey}
                    className={`mb-4 transition-opacity duration-200 ${index < 3 ? 'opacity-100' : 'opacity-45 hover:opacity-100 focus-within:opacity-100'}`}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        if (onOpenDate && group.dateKey !== 'unscheduled') onOpenDate(group.dateKey);
                        else toggleGroupCollapsed(group.dateKey);
                      }}
                      className="mb-2 flex w-full items-center justify-between px-0 py-2 text-left transition-opacity hover:opacity-100"
                    >
                      <div className="text-[14px] font-medium tracking-[-0.02em] text-[var(--text-primary)]">{group.label}</div>
                      <div className="flex items-center gap-3 text-[var(--text-muted)]">
                        <span className="text-[10px] font-bold uppercase tracking-[0.16em]">{group.rows.length}</span>
                        {isCollapsed ? <ChevronRight size={15} /> : <ChevronDown size={15} />}
                      </div>
                    </button>

                    {!isCollapsed && group.rows.map((row) => (
                      <OutlineTaskRow
                        key={row.task.id}
                        task={row.task}
                        allTasks={allTasks}
                        projects={projects}
                        depth={row.depth}
                        childCount={childCounts.get(row.task.id) || 0}
                        hasChildren={row.hasChildren}
                        isContextAncestor={row.isContextAncestor}
                        canIndent={canIndentTask(row.task.id)}
                        canOutdent={canOutdentTask(row.task.id)}
                        canMoveUp={canMoveTaskUp(row.task.id)}
                        canMoveDown={canMoveTaskDown(row.task.id)}
                        onToggleComplete={onToggleComplete}
                        onToggleStar={onToggleStar}
                        onUpdate={onUpdateTask}
                        onOpenTask={onOpenTask}
                        onToggleCollapsed={onToggleTaskCollapsed}
                        onIndent={handleIndentTask}
                        onOutdent={handleOutdentTask}
                        onMoveUp={handleMoveTaskUp}
                        onMoveDown={handleMoveTaskDown}
                        onMoveBefore={handleMoveTaskBeforeList}
                        onMoveAfter={handleMoveTaskAfterList}
                        onNestInto={handleNestTaskList}
                        canNestTask={(sourceId, targetId) => canReparentTask(sourceId, targetId, allTasks)}
                        onAddSubtask={onAddSubtask}
                      />
                    ))}
                  </section>
                );
              })}
            </>
          ) : taskListMode === 'outline' ? (
            <>
              {outlineRows.map((row) => (
                <OutlineTaskRow
                  key={row.task.id}
                  task={row.task}
                  allTasks={allTasks}
                  projects={projects}
                  depth={row.depth}
                  childCount={childCounts.get(row.task.id) || 0}
                  hasChildren={row.hasChildren}
                  isContextAncestor={row.isContextAncestor}
                  canIndent={canIndentTask(row.task.id)}
                  canOutdent={canOutdentTask(row.task.id)}
                  canMoveUp={canMoveTaskUp(row.task.id)}
                  canMoveDown={canMoveTaskDown(row.task.id)}
                  onToggleComplete={onToggleComplete}
                  onToggleStar={onToggleStar}
                  onUpdate={onUpdateTask}
                  onOpenTask={onOpenTask}
                  onToggleCollapsed={onToggleTaskCollapsed}
                  onIndent={handleIndentTask}
                  onOutdent={handleOutdentTask}
                  onMoveUp={handleMoveTaskUp}
                  onMoveDown={handleMoveTaskDown}
                  onMoveBefore={handleMoveTaskBeforeList}
                  onMoveAfter={handleMoveTaskAfterList}
                  onNestInto={handleNestTaskList}
                  canNestTask={(sourceId, targetId) => canReparentTask(sourceId, targetId, allTasks)}
                  onAddSubtask={onAddSubtask}
                />
              ))}
            </>
          ) : (
            <>
              {topLevelListTasks.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  allTasks={allTasks}
                  projects={projects}
                  childCount={childCounts.get(task.id) || 0}
                  onToggleStar={onToggleStar}
                  onToggleComplete={onToggleComplete}
                  onUpdate={onUpdateTask}
                  onMoveBefore={handleMoveTaskBeforeList}
                  onMoveAfter={handleMoveTaskAfterList}
                  onNestInto={handleNestTaskList}
                  onDelete={onDeleteTask}
                  onOpenTask={onOpenTask}
                  canNestTask={(sourceId, targetId) => canReparentTask(sourceId, targetId, allTasks)}
                  onAddSubtask={onAddSubtask}
                />
              ))}
            </>
          )}
          <GhostItem
            placeholder={taskListMode === 'outline' ? 'Tab to indent... Or type a top bullet' : 'Click to add a new task...'}
            onAdd={handleAddTask}
            className="mt-3 px-5 py-3 opacity-50 hover:opacity-100"
            iconSize={16}
          />
        </div>
      </div>
    );
  };

const formatScheduledGroupLabel = (dateKey: string) => {
  if (dateKey === 'unscheduled') return 'No Date';

  const date = new Date(`${dateKey}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  if (date.getTime() === today.getTime()) return `Today · ${date.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}`;
  if (date.getTime() === tomorrow.getTime()) return `Tomorrow · ${date.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}`;

  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
};
