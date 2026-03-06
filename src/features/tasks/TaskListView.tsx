import React, { useMemo, useState } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { GhostItem } from '../../components/GhostItem';
import { DayPart, Project, Task, TaskListMode } from '../../types';
import { OutlineTaskRow } from './OutlineTaskRow';
import { TaskRow } from './TaskRow';
import { buildVisibleTaskTree, canReparentTask } from './taskTree';

type FocusedDayPart = DayPart | 'unassigned' | null;

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
  groupDayViewByPart: boolean;
  backLabel?: string;
  onExpandTask: (id: string | null) => void;
  onAddTask: (title: string, dayPart?: DayPart | null) => void;
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
  groupDayViewByPart,
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
    const [dragOverDayPart, setDragOverDayPart] = useState<string | null>(null);
    const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());
    const [selectionAnchorId, setSelectionAnchorId] = useState<string | null>(null);
    const [marqueeRect, setMarqueeRect] = useState<{ left: number; top: number; width: number; height: number } | null>(null);
    const [focusedDayPart, setFocusedDayPart] = useState<FocusedDayPart>(null);
    const containerRef = React.useRef<HTMLDivElement>(null);
    const marqueeStartRef = React.useRef<{ x: number; y: number } | null>(null);
    const lastParentIdForGhost = React.useRef<string | null>(null);

    const listTasks = useMemo(() => {
      return [...tasks].sort((left, right) => {
        if (left.isStarred === right.isStarred) return 0;
        return left.isStarred ? -1 : 1;
      });
    }, [tasks]);
    const topLevelListTasks = useMemo(() => listTasks.filter((task) => !task.parentId), [listTasks]);
    const visibleListTasks = useMemo(() => currentView === 'day' ? listTasks : topLevelListTasks, [currentView, listTasks, topLevelListTasks]);

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
    const isGroupedDayView = currentView === 'day' && groupDayViewByPart;

    const dayPartSections = useMemo(() => {
      const order: Array<{ key: DayPart | null; id: string; label: string }> = [
        { key: null, id: 'unassigned', label: 'Unassigned' },
        { key: 'morning', id: 'morning', label: 'Morning' },
        { key: 'afternoon', id: 'afternoon', label: 'Afternoon' },
        { key: 'evening', id: 'evening', label: 'Evening' },
      ];
      return order.map((section) => ({
        ...section,
        listTasks: visibleListTasks.filter((task) => task.dayPart === section.key),
        outlineRows: outlineRows.filter((row) => row.task.dayPart === section.key),
      }));
    }, [outlineRows, visibleListTasks]);
    const visibleDayPartSections = useMemo(() => {
      const sections = dayPartSections.filter((section) => section.key !== null || section.listTasks.length > 0 || section.outlineRows.length > 0 || dragOverDayPart === section.id);
      if (!focusedDayPart) return sections;
      return sections.filter((section) => section.id === focusedDayPart);
    }, [dayPartSections, dragOverDayPart, focusedDayPart]);
    const focusedDayPartLabel = useMemo(
      () => dayPartSections.find((section) => section.id === focusedDayPart)?.label ?? null,
      [dayPartSections, focusedDayPart]
    );

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

    const orderedVisibleTaskIds = useMemo(() => {
      if (isGroupedDayView && taskListMode === 'list') return dayPartSections.flatMap((section) => section.listTasks.map((task) => task.id));
      if (isGroupedDayView && taskListMode === 'outline') return dayPartSections.flatMap((section) => section.outlineRows.map((row) => row.task.id));
      if (isScheduledView && taskListMode === 'list') return scheduledListGroups.flatMap((group) => group.items.map((task) => task.id));
      if (isScheduledView && taskListMode === 'outline') return scheduledOutlineGroups.flatMap((group) => group.rows.map((row) => row.task.id));
      if (taskListMode === 'outline') return outlineRows.map((row) => row.task.id);
      return visibleListTasks.map((task) => task.id);
    }, [dayPartSections, isGroupedDayView, isScheduledView, outlineRows, scheduledListGroups, scheduledOutlineGroups, taskListMode, visibleListTasks]);

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

    const getOrderedDraggedTaskIds = (sourceId: string) => {
      const currentSelection = selectedTaskIds.has(sourceId) ? Array.from(selectedTaskIds) : [sourceId];
      return orderedVisibleTaskIds.filter((taskId) => currentSelection.includes(taskId));
    };

    const handleMoveTaskGroupBeforeList = (sourceId: string, targetId: string) => {
      for (const taskId of getOrderedDraggedTaskIds(sourceId)) {
        handleMoveTaskBeforeList(taskId, targetId);
      }
    };

    const handleMoveTaskGroupAfterList = (sourceId: string, targetId: string) => {
      const ordered = getOrderedDraggedTaskIds(sourceId);
      for (const taskId of [...ordered].reverse()) {
        handleMoveTaskAfterList(taskId, targetId);
      }
    };

    const handleNestTaskGroupList = (sourceId: string, targetId: string) => {
      const ordered = getOrderedDraggedTaskIds(sourceId);
      for (const taskId of [...ordered].reverse()) {
        handleNestTaskList(taskId, targetId);
      }
    };

    const assignTaskToDayPart = (taskId: string, dayPart: DayPart | null) => {
      onUpdateTask(taskId, { dayPart });
    };

    const clearSelection = () => {
      setSelectedTaskIds(new Set());
      setSelectionAnchorId(null);
    };

    const handleSelectTask = (event: React.MouseEvent, taskId: string) => {
      event.preventDefault();
      event.stopPropagation();

      if (event.shiftKey && selectionAnchorId) {
        const startIndex = orderedVisibleTaskIds.indexOf(selectionAnchorId);
        const endIndex = orderedVisibleTaskIds.indexOf(taskId);
        if (startIndex !== -1 && endIndex !== -1) {
          const [from, to] = startIndex < endIndex ? [startIndex, endIndex] : [endIndex, startIndex];
          setSelectedTaskIds(new Set(orderedVisibleTaskIds.slice(from, to + 1)));
          return;
        }
      }

      if (event.metaKey || event.ctrlKey) {
        setSelectedTaskIds((prev) => {
          const next = new Set(prev);
          if (next.has(taskId)) next.delete(taskId);
          else next.add(taskId);
          return next;
        });
        setSelectionAnchorId(taskId);
        return;
      }

      setSelectedTaskIds(new Set([taskId]));
      setSelectionAnchorId(taskId);
    };

    React.useEffect(() => {
      setSelectedTaskIds((prev) => new Set(Array.from(prev).filter((taskId) => orderedVisibleTaskIds.includes(taskId))));
      if (selectionAnchorId && !orderedVisibleTaskIds.includes(selectionAnchorId)) {
        setSelectionAnchorId(null);
      }
    }, [orderedVisibleTaskIds, selectionAnchorId]);

    React.useEffect(() => {
      if (!focusedDayPart) return;
      const stillExists = dayPartSections.some((section) => section.id === focusedDayPart && (section.key !== null || section.listTasks.length > 0 || section.outlineRows.length > 0));
      if (!stillExists && dragOverDayPart !== focusedDayPart) {
        setFocusedDayPart(null);
      }
    }, [dayPartSections, dragOverDayPart, focusedDayPart]);

    const handleBulkToggleComplete = () => {
      selectedTaskIds.forEach((taskId) => onToggleComplete(taskId));
    };

    const handleBulkDelete = () => {
      Array.from(selectedTaskIds).forEach((taskId) => onDeleteTask(taskId));
      clearSelection();
    };

    const handleContainerMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
      const target = event.target as HTMLElement;
      const isTaskRow = Boolean(target.closest('[data-task-row="true"]'));
      const isInteractive = Boolean(target.closest('button, input, textarea, select, a, [role="button"]'));

      if (event.altKey && !isInteractive && containerRef.current) {
        event.preventDefault();
        event.stopPropagation();
        const containerRect = containerRef.current.getBoundingClientRect();
        marqueeStartRef.current = {
          x: event.clientX - containerRect.left + containerRef.current.scrollLeft,
          y: event.clientY - containerRect.top + containerRef.current.scrollTop,
        };
        setMarqueeRect({ left: marqueeStartRef.current.x, top: marqueeStartRef.current.y, width: 0, height: 0 });

        const handleMouseMove = (moveEvent: MouseEvent) => {
          if (!containerRef.current || !marqueeStartRef.current) return;
          const rect = containerRef.current.getBoundingClientRect();
          const currentX = moveEvent.clientX - rect.left + containerRef.current.scrollLeft;
          const currentY = moveEvent.clientY - rect.top + containerRef.current.scrollTop;
          const left = Math.min(marqueeStartRef.current.x, currentX);
          const top = Math.min(marqueeStartRef.current.y, currentY);
          const width = Math.abs(currentX - marqueeStartRef.current.x);
          const height = Math.abs(currentY - marqueeStartRef.current.y);
          setMarqueeRect({ left, top, width, height });

          const selectionBounds = {
            left: Math.min(moveEvent.clientX, rect.left + marqueeStartRef.current.x - containerRef.current.scrollLeft),
            right: Math.max(moveEvent.clientX, rect.left + marqueeStartRef.current.x - containerRef.current.scrollLeft),
            top: Math.min(moveEvent.clientY, rect.top + marqueeStartRef.current.y - containerRef.current.scrollTop),
            bottom: Math.max(moveEvent.clientY, rect.top + marqueeStartRef.current.y - containerRef.current.scrollTop),
          };

          const hitIds = Array.from(containerRef.current.querySelectorAll('[data-task-row="true"][data-task-id]'))
            .filter((node) => {
              const el = node as HTMLElement;
              const nodeRect = el.getBoundingClientRect();
              return !(
                nodeRect.right < selectionBounds.left ||
                nodeRect.left > selectionBounds.right ||
                nodeRect.bottom < selectionBounds.top ||
                nodeRect.top > selectionBounds.bottom
              );
            })
            .map((node) => (node as HTMLElement).dataset.taskId!)
            .filter(Boolean);

          setSelectedTaskIds(new Set(hitIds));
          setSelectionAnchorId(hitIds[0] || null);
        };

        const handleMouseUp = () => {
          marqueeStartRef.current = null;
          setMarqueeRect(null);
          window.removeEventListener('mousemove', handleMouseMove);
          window.removeEventListener('mouseup', handleMouseUp);
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
        return;
      }

      if (!event.altKey && !isTaskRow && !isInteractive && selectedTaskIds.size > 0) {
        clearSelection();
      }
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
        <div className="task-list-header mb-6 sm:mb-8">
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
          <div className="flex flex-wrap items-end justify-between gap-3 sm:gap-4">
            <div className="min-w-0">
              <h1 className="text-[22px] font-medium leading-[1.05] tracking-[-0.03em] text-[var(--text-primary)] sm:text-[26px]">{headerTitle}</h1>
              <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] font-medium text-[var(--text-muted)]">
                {(taskListMode === 'list' ? visibleListTasks.length : itemCount)} items
                {selectedArea && <span>Area: {selectedArea}</span>}
                {selectedProjectId && <span>Project scoped</span>}
              </div>
            </div>

          </div>
        </div>

        {selectedTaskIds.size > 0 && (
          <div className="panel-muted mb-4 flex flex-col gap-3 rounded-2xl border soft-divider px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:py-2.5">
            <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--text-muted)]">
              {selectedTaskIds.size} selected
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={handleBulkToggleComplete} className="rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--text-primary)] transition-colors hover:bg-[rgba(255,255,255,0.04)]">
                Toggle Complete
              </button>
              <button type="button" onClick={handleBulkDelete} className="rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--danger)] transition-colors hover:bg-[var(--danger-soft)]/20">
                Delete
              </button>
              <button type="button" onClick={clearSelection} className="rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--text-muted)] transition-colors hover:bg-[rgba(255,255,255,0.04)]">
                Clear
              </button>
            </div>
          </div>
        )}

        <div ref={containerRef} onMouseDown={handleContainerMouseDown} className="minimal-surface relative overflow-visible">
          {marqueeRect && (
            <div
              className="pointer-events-none absolute z-20 rounded-lg border border-[var(--accent)]/70 bg-[var(--accent)]/10"
              style={{
                left: marqueeRect.left,
                top: marqueeRect.top,
                width: marqueeRect.width,
                height: marqueeRect.height,
              }}
            />
          )}
          {isGroupedDayView && focusedDayPartLabel && (
            <div className="day-part-header mb-4 flex flex-wrap items-center gap-2 text-[11px] font-medium uppercase tracking-[0.12em] text-[var(--text-muted)]">
              <button
                type="button"
                onClick={() => setFocusedDayPart(null)}
                className="inline-flex items-center gap-1.5 transition-colors hover:text-[var(--text-primary)]"
              >
                <ChevronLeft size={13} />
                <span>Day</span>
              </button>
              <span className="opacity-40">/</span>
              <span className="text-[var(--text-primary)]">{focusedDayPartLabel}</span>
            </div>
          )}
          {isGroupedDayView && taskListMode === 'list' ? (
            <>
              {visibleDayPartSections.map((section) => (
                <section
                  key={section.id}
                  className={`mb-5 last:mb-0 rounded-2xl transition-colors ${dragOverDayPart === section.id ? 'bg-[rgba(255,255,255,0.03)]' : ''}`}
                  onDragOver={(event) => {
                    const hasTaskDragPayload = Array.from(event.dataTransfer.types || []).includes('taskid');
                    if (!hasTaskDragPayload) return;
                    event.preventDefault();
                    setDragOverDayPart(section.id);
                  }}
                  onDragLeave={(event) => {
                    if (!event.currentTarget.contains(event.relatedTarget as Node)) {
                      setDragOverDayPart((current) => current === section.id ? null : current);
                    }
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    setDragOverDayPart(null);
                    const taskId = event.dataTransfer.getData('taskId');
                    if (!taskId) return;
                    const lastTask = section.listTasks[section.listTasks.length - 1];
                    if (lastTask) handleMoveTaskGroupAfterList(taskId, lastTask.id);
                    getOrderedDraggedTaskIds(taskId).forEach((draggedTaskId) => assignTaskToDayPart(draggedTaskId, section.key));
                  }}
                >
                  <div className={`mb-2 flex items-center border-b soft-divider pb-2 ${focusedDayPart === section.id ? 'justify-end' : 'justify-between'}`}>
                    {focusedDayPart !== section.id && (
                      <button
                        type="button"
                        onClick={() => setFocusedDayPart(section.id as FocusedDayPart)}
                        className="inline-flex items-center gap-2 rounded-full px-1 py-0.5 text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)]"
                      >
                        <span>{section.label}</span>
                      </button>
                    )}
                    <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--text-muted)]">{section.listTasks.length}</div>
                  </div>
                  <div className="space-y-0.5">
                    <DayPartDropZone
                      label={`Move to ${section.label}`}
                      onDropTask={(taskId) => {
                        const firstTask = section.listTasks[0];
                        if (firstTask) handleMoveTaskGroupBeforeList(taskId, firstTask.id);
                        getOrderedDraggedTaskIds(taskId).forEach((draggedTaskId) => assignTaskToDayPart(draggedTaskId, section.key));
                      }}
                    />
                    {section.listTasks.map((task) => (
                      <TaskRow
                        key={task.id}
                        task={task}
                        allTasks={allTasks}
                        projects={projects}
                        childCount={childCounts.get(task.id) || 0}
                        compact={true}
                        selected={selectedTaskIds.has(task.id)}
                        selectionActive={selectedTaskIds.size > 0}
                        selectedTaskIds={Array.from(selectedTaskIds)}
                        onSelect={handleSelectTask}
                        onToggleStar={onToggleStar}
                        onToggleComplete={onToggleComplete}
                        onUpdate={onUpdateTask}
                        onMoveBefore={(sourceId, targetId) => {
                          handleMoveTaskGroupBeforeList(sourceId, targetId);
                          getOrderedDraggedTaskIds(sourceId).forEach((draggedTaskId) => assignTaskToDayPart(draggedTaskId, section.key));
                        }}
                        onMoveAfter={(sourceId, targetId) => {
                          handleMoveTaskGroupAfterList(sourceId, targetId);
                          getOrderedDraggedTaskIds(sourceId).forEach((draggedTaskId) => assignTaskToDayPart(draggedTaskId, section.key));
                        }}
                        onNestInto={(sourceId, targetId) => {
                          handleNestTaskGroupList(sourceId, targetId);
                          getOrderedDraggedTaskIds(sourceId).forEach((draggedTaskId) => assignTaskToDayPart(draggedTaskId, section.key));
                        }}
                        onDelete={onDeleteTask}
                        onOpenTask={onOpenTask}
                        canNestTask={(sourceId, targetId) => canReparentTask(sourceId, targetId, allTasks)}
                        onAddSubtask={onAddSubtask}
                      />
                    ))}
                    <GhostItem
                      placeholder={`Add to ${section.label.toLowerCase()}...`}
                      onAdd={(title) => onAddTask(title, section.key)}
                      className="mt-2 px-4 py-2 opacity-40 hover:opacity-100"
                      iconSize={14}
                    />
                  </div>
                </section>
              ))}
            </>
          ) : isGroupedDayView && taskListMode === 'outline' ? (
            <>
              {visibleDayPartSections.map((section) => (
                <section
                  key={section.id}
                  className={`mb-5 last:mb-0 rounded-2xl transition-colors ${dragOverDayPart === section.id ? 'bg-[rgba(255,255,255,0.03)]' : ''}`}
                  onDragOver={(event) => {
                    const hasTaskDragPayload = Array.from(event.dataTransfer.types || []).includes('taskid');
                    if (!hasTaskDragPayload) return;
                    event.preventDefault();
                    setDragOverDayPart(section.id);
                  }}
                  onDragLeave={(event) => {
                    if (!event.currentTarget.contains(event.relatedTarget as Node)) {
                      setDragOverDayPart((current) => current === section.id ? null : current);
                    }
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    setDragOverDayPart(null);
                    const taskId = event.dataTransfer.getData('taskId');
                    if (!taskId) return;
                    const lastRow = section.outlineRows[section.outlineRows.length - 1];
                    if (lastRow) handleMoveTaskGroupAfterList(taskId, lastRow.task.id);
                    getOrderedDraggedTaskIds(taskId).forEach((draggedTaskId) => assignTaskToDayPart(draggedTaskId, section.key));
                  }}
                >
                  <div className={`mb-2 flex items-center border-b soft-divider pb-2 ${focusedDayPart === section.id ? 'justify-end' : 'justify-between'}`}>
                    {focusedDayPart !== section.id && (
                      <button
                        type="button"
                        onClick={() => setFocusedDayPart(section.id as FocusedDayPart)}
                        className="inline-flex items-center gap-2 rounded-full px-1 py-0.5 text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)]"
                      >
                        <span>{section.label}</span>
                      </button>
                    )}
                    <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--text-muted)]">{section.outlineRows.length}</div>
                  </div>
                  <div className="space-y-0.5">
                    <DayPartDropZone
                      label={`Move to ${section.label}`}
                      onDropTask={(taskId) => {
                        const firstRow = section.outlineRows[0];
                        if (firstRow) handleMoveTaskGroupBeforeList(taskId, firstRow.task.id);
                        getOrderedDraggedTaskIds(taskId).forEach((draggedTaskId) => assignTaskToDayPart(draggedTaskId, section.key));
                      }}
                    />
                    {section.outlineRows.map((row) => (
                      <OutlineTaskRow
                        key={row.task.id}
                        task={row.task}
                        allTasks={allTasks}
                        projects={projects}
                        depth={row.depth}
                        childCount={childCounts.get(row.task.id) || 0}
                        compact={true}
                        selected={selectedTaskIds.has(row.task.id)}
                        selectionActive={selectedTaskIds.size > 0}
                        selectedTaskIds={Array.from(selectedTaskIds)}
                        onSelect={handleSelectTask}
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
                        onMoveBefore={(sourceId, targetId) => {
                          handleMoveTaskGroupBeforeList(sourceId, targetId);
                          getOrderedDraggedTaskIds(sourceId).forEach((draggedTaskId) => assignTaskToDayPart(draggedTaskId, section.key));
                        }}
                        onMoveAfter={(sourceId, targetId) => {
                          handleMoveTaskGroupAfterList(sourceId, targetId);
                          getOrderedDraggedTaskIds(sourceId).forEach((draggedTaskId) => assignTaskToDayPart(draggedTaskId, section.key));
                        }}
                        onNestInto={(sourceId, targetId) => {
                          handleNestTaskGroupList(sourceId, targetId);
                          getOrderedDraggedTaskIds(sourceId).forEach((draggedTaskId) => assignTaskToDayPart(draggedTaskId, section.key));
                        }}
                        canNestTask={(sourceId, targetId) => canReparentTask(sourceId, targetId, allTasks)}
                        onAddSubtask={onAddSubtask}
                      />
                    ))}
                    <GhostItem
                      placeholder={`Add to ${section.label.toLowerCase()}...`}
                      onAdd={(title) => onAddTask(title, section.key)}
                      className="mt-2 px-4 py-2 opacity-40 hover:opacity-100"
                      iconSize={14}
                    />
                  </div>
                </section>
              ))}
            </>
          ) : isScheduledView && taskListMode === 'list' ? (
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
                        selected={selectedTaskIds.has(task.id)}
                        selectionActive={selectedTaskIds.size > 0}
                        selectedTaskIds={Array.from(selectedTaskIds)}
                        onSelect={handleSelectTask}
                        onToggleStar={onToggleStar}
                        onToggleComplete={onToggleComplete}
                        onUpdate={onUpdateTask}
                        onMoveBefore={handleMoveTaskGroupBeforeList}
                        onMoveAfter={handleMoveTaskGroupAfterList}
                        onNestInto={handleNestTaskGroupList}
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
                        selected={selectedTaskIds.has(row.task.id)}
                        selectionActive={selectedTaskIds.size > 0}
                        selectedTaskIds={Array.from(selectedTaskIds)}
                        onSelect={handleSelectTask}
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
                        onMoveBefore={handleMoveTaskGroupBeforeList}
                        onMoveAfter={handleMoveTaskGroupAfterList}
                        onNestInto={handleNestTaskGroupList}
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
                  compact={currentView === 'day'}
                  selected={selectedTaskIds.has(row.task.id)}
                  selectionActive={selectedTaskIds.size > 0}
                  selectedTaskIds={Array.from(selectedTaskIds)}
                  onSelect={handleSelectTask}
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
                  onMoveBefore={handleMoveTaskGroupBeforeList}
                  onMoveAfter={handleMoveTaskGroupAfterList}
                  onNestInto={handleNestTaskGroupList}
                  canNestTask={(sourceId, targetId) => canReparentTask(sourceId, targetId, allTasks)}
                  onAddSubtask={onAddSubtask}
                />
              ))}
            </>
          ) : (
            <>
              {visibleListTasks.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  allTasks={allTasks}
                  projects={projects}
                  childCount={childCounts.get(task.id) || 0}
                  compact={currentView === 'day'}
                  selected={selectedTaskIds.has(task.id)}
                  selectionActive={selectedTaskIds.size > 0}
                  selectedTaskIds={Array.from(selectedTaskIds)}
                  onSelect={handleSelectTask}
                  onToggleStar={onToggleStar}
                  onToggleComplete={onToggleComplete}
                  onUpdate={onUpdateTask}
                  onMoveBefore={handleMoveTaskGroupBeforeList}
                  onMoveAfter={handleMoveTaskGroupAfterList}
                  onNestInto={handleNestTaskGroupList}
                  onDelete={onDeleteTask}
                  onOpenTask={onOpenTask}
                  canNestTask={(sourceId, targetId) => canReparentTask(sourceId, targetId, allTasks)}
                  onAddSubtask={onAddSubtask}
                />
              ))}
            </>
          )}
          {!isGroupedDayView && (
            <GhostItem
              placeholder={taskListMode === 'outline' ? 'Tab to indent... Or type a top bullet' : 'Click to add a new task...'}
              onAdd={handleAddTask}
              className="mt-3 px-5 py-3 opacity-50 hover:opacity-100"
              iconSize={16}
            />
          )}
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

const DayPartDropZone: React.FC<{
  label: string;
  onDropTask: (id: string) => void;
}> = ({ label, onDropTask }) => {
  const hasTaskDragPayload = (dataTransfer: DataTransfer) => Array.from(dataTransfer.types || []).includes('taskid');
  const [isDragOver, setIsDragOver] = useState(false);

  return (
    <div
      className={`relative transition-[height] ${isDragOver ? 'h-6' : 'h-[3px]'}`}
      onDragEnter={() => setIsDragOver(true)}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node)) {
          setIsDragOver(false);
        }
      }}
      onDragOver={(event) => {
        if (!hasTaskDragPayload(event.dataTransfer)) return;
        event.preventDefault();
        setIsDragOver(true);
      }}
      onDrop={(event) => {
        event.preventDefault();
        setIsDragOver(false);
        const id = event.dataTransfer.getData('taskId');
        if (id) onDropTask(id);
      }}
    >
      <div className={`absolute inset-x-0 top-1/2 h-[2px] -translate-y-1/2 transition-colors ${isDragOver ? 'bg-[var(--accent)]/90' : 'bg-transparent'}`} />
      {isDragOver && (
        <div className="pointer-events-none absolute right-1 top-1/2 -translate-y-1/2 rounded-full bg-[var(--accent-soft)] px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] text-[var(--accent)]">
          {label}
        </div>
      )}
    </div>
  );
};
