import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  ChevronDown,
  ChevronRight,
  CornerDownRight,
  ExternalLink,
  GripVertical,
  AlignLeft,
  Plus,
  Star,
} from 'lucide-react';
import { TaskCheckbox } from '../../components/TaskCheckbox';
import { TaskTimerDot } from '../../components/timer/TaskTimerDot';
import { Project, Task } from '../../types';

export const OutlineTaskRow: React.FC<{
  task: Task;
  allTasks: Task[];
  projects: Project[];
  depth: number;
  childCount: number;
  compact?: boolean;
  selected?: boolean;
  selectionActive?: boolean;
  selectedTaskIds?: string[];
  onSelect?: (event: React.MouseEvent, taskId: string) => void;
  hasChildren: boolean;
  isContextAncestor: boolean;
  canIndent: boolean;
  canOutdent: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onToggleComplete: (id: string) => void;
  onToggleStar: (id: string) => void;
  onUpdate: (id: string, updates: Partial<Task>) => void;
  onOpenTask: (task: Task) => void;
  onToggleCollapsed: (id: string) => void;
  onIndent: (id: string) => void;
  onOutdent: (id: string) => void;
  onMoveUp: (id: string) => void;
  onMoveDown: (id: string) => void;
  onMoveBefore: (sourceId: string, targetId: string) => void;
  onMoveAfter: (sourceId: string, targetId: string) => void;
  onNestInto: (sourceId: string, targetId: string) => void;
  canNestTask: (sourceId: string, targetId: string) => boolean;
  onAddSubtask: (parentTask: Task, title: string) => void;
}> = ({
  task,
  allTasks,
  projects,
  depth,
  childCount,
  compact = false,
  selected = false,
  selectionActive = false,
  selectedTaskIds = [],
  onSelect,
  hasChildren,
  isContextAncestor,
  isExpanded,
  canIndent,
  canOutdent,
  canMoveUp,
  canMoveDown,
  onToggleComplete,
  onToggleStar,
  onUpdate,
  onOpenTask,
  onToggleCollapsed,
  onIndent,
  onOutdent,
  onMoveUp,
  onMoveDown,
  onMoveBefore,
  onMoveAfter,
  onNestInto,
  canNestTask,
  onAddSubtask,
}) => {
    const hasTaskDragPayload = (dataTransfer: DataTransfer) => Array.from(dataTransfer.types || []).includes('taskid');
    const [isOver, setIsOver] = useState(false);
    const [dropMode, setDropMode] = useState<'before' | 'inside' | 'after'>('inside');
    const [isEditingTitle, setIsEditingTitle] = useState(false);
    const [showNotesEditor, setShowNotesEditor] = useState(false);
    const [isAddingSubtask, setIsAddingSubtask] = useState(false);
    const [draftSubtaskTitle, setDraftSubtaskTitle] = useState('');
    const [draftTitle, setDraftTitle] = useState(task.title);
    const [isJustCompleted, setIsJustCompleted] = useState(false);
    const clickTimeoutRef = useRef<number | null>(null);
    const prevStatusRef = useRef(task.status);

    useEffect(() => {
      setDraftTitle(task.title);
    }, [task.title]);

    useEffect(() => {
      // This effect previously depended on `isExpanded`.
      // Since `isExpanded` is removed, this logic might need re-evaluation
      // based on how `isExpanded` was used to control these states.
      // For now, removing the `isExpanded` dependency and condition.
      // If these states should be reset on some other condition, that condition
      // should be added here.
      setShowNotesEditor(false);
      setIsAddingSubtask(false);
      setDraftSubtaskTitle('');
    }, [task.id]); // Changed dependency to task.id to reset on task change

    useEffect(() => {
      if (prevStatusRef.current !== 'completed' && task.status === 'completed') {
        setIsJustCompleted(true);
        const timer = setTimeout(() => setIsJustCompleted(false), 600);
        return () => clearTimeout(timer);
      } else if (task.status !== 'completed') {
        setIsJustCompleted(false);
      }
      prevStatusRef.current = task.status;
    }, [task.status]);

    const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (isEditingTitle) return;
      if (event.key === 'Tab') {
        event.preventDefault();
        if (event.shiftKey) onOutdent(task.id);
        else onIndent(task.id);
        return;
      }

      if (event.altKey && event.key === 'ArrowUp') {
        event.preventDefault();
        onMoveUp(task.id);
        return;
      }

      if (event.altKey && event.key === 'ArrowDown') {
        event.preventDefault();
        onMoveDown(task.id);
        return;
      }

      if (event.key === 'Enter') {
        event.preventDefault();
        onOpenTask(task);
      }
    };

    const handleRowClick = (event: React.MouseEvent) => {
      if (isEditingTitle) return;
      if (selectionActive || event.metaKey || event.ctrlKey || event.shiftKey) {
        onSelect?.(event, task.id);
        return;
      }
      if (clickTimeoutRef.current) window.clearTimeout(clickTimeoutRef.current);
      clickTimeoutRef.current = window.setTimeout(() => {
        setDraftTitle(task.title);
        setIsEditingTitle(true);
        clickTimeoutRef.current = null;
      }, 180);
    };

    const handleTitleDoubleClick = (event: React.MouseEvent) => {
      event.stopPropagation();
      if (clickTimeoutRef.current) {
        window.clearTimeout(clickTimeoutRef.current);
        clickTimeoutRef.current = null;
      }
      onOpenTask(task);
    };

    const commitTitleEdit = () => {
      const nextTitle = draftTitle.trim();
      if (nextTitle && nextTitle !== task.title) onUpdate(task.id, { title: nextTitle });
      setDraftTitle(nextTitle || task.title);
      setIsEditingTitle(false);
    };

    const commitSubtask = (keepOpen = false) => {
      const nextTitle = draftSubtaskTitle.trim();
      if (!nextTitle) {
        setIsAddingSubtask(false);
        setDraftSubtaskTitle('');
        return;
      }
      onAddSubtask(task, nextTitle);
      setDraftSubtaskTitle('');
      setIsAddingSubtask(keepOpen);
    };
    const subtasks = allTasks.filter((item) => item.parentId === task.id);

    const handleDragStart = (event: React.DragEvent) => {
      if (event.altKey) {
        event.preventDefault();
        return;
      }
      event.dataTransfer.setData('taskId', task.id);
      if (selected && selectedTaskIds.length > 1) {
        event.dataTransfer.setData('taskIds', JSON.stringify(selectedTaskIds));
      }
      event.dataTransfer.setData('context', 'reorder');
      event.dataTransfer.effectAllowed = 'move';
    };

    return (
      <div
        tabIndex={0}
        data-task-row="true"
        data-task-id={task.id}
        onKeyDown={handleKeyDown}
        draggable
        onDragStart={handleDragStart}
        onDragOver={(event) => {
          event.preventDefault();
          if (!hasTaskDragPayload(event.dataTransfer)) return;
          const rect = event.currentTarget.getBoundingClientRect();
          const ratio = (event.clientY - rect.top) / rect.height;
          let nextMode: 'before' | 'inside' | 'after';
          if (hasChildren && !task.collapsed) {
            // Expanded parent: tiny top strip = "before", everything else = "inside" (add to this group)
            // because children are already visible below — dropping in the body means "add to me"
            nextMode = ratio < 0.18 ? 'before' : 'inside';
          } else {
            // Collapsed parent or leaf: three equal zones
            nextMode = ratio < 0.28 ? 'before' : ratio > 0.72 ? 'after' : 'inside';
          }
          setDropMode(nextMode);
          setIsOver(true);
        }}
        onDragLeave={(event) => {
          // Only clear when leaving the actual row boundary, not a child element
          if (!event.currentTarget.contains(event.relatedTarget as Node)) {
            setIsOver(false);
            setDropMode('inside');
          }
        }}
        onDrop={(event) => {
          event.preventDefault();
          setIsOver(false);
          const draggedIds = (() => {
            const raw = event.dataTransfer.getData('taskIds');
            if (!raw) return [event.dataTransfer.getData('taskId')].filter(Boolean);
            try {
              return JSON.parse(raw) as string[];
            } catch {
              return [event.dataTransfer.getData('taskId')].filter(Boolean);
            }
          })();
          const filteredIds = draggedIds.filter((sourceId) => sourceId && sourceId !== task.id);
          if (filteredIds.length > 0 && hasTaskDragPayload(event.dataTransfer)) {
            const primaryId = filteredIds[0];
            if (dropMode === 'before') onMoveBefore(primaryId, task.id);
            else if (dropMode === 'after') onMoveAfter(primaryId, task.id);
            else if (canNestTask(primaryId, task.id)) onNestInto(primaryId, task.id);
            else onMoveAfter(primaryId, task.id);
          }
          setDropMode('inside');
        }}
        className={`group relative rounded-2xl transition-all outline-none hover:bg-[rgba(255,255,255,0.018)] focus:bg-[rgba(255,255,255,0.025)] ${selected ? 'bg-[var(--accent-soft)]/50 ring-1 ring-[var(--accent)]/55' : ''} ${isContextAncestor ? 'opacity-75' : ''} ${isJustCompleted ? 'brutal-row-bounce' : ''}`}
      >
        {/* BEFORE: top gradient wash + sharp top edge line — visually occupies the top of the row */}
        {isOver && dropMode === 'before' && (
          <>
            <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-1/2 rounded-t-2xl bg-gradient-to-b from-[var(--accent)]/20 to-transparent" />
            <div className="pointer-events-none absolute top-0 z-20 h-[3px] rounded-r-full bg-[var(--accent)]" style={{ left: `${16 + depth * 24}px`, right: 0 }} />
          </>
        )}
        {/* INSIDE: full row tint — you're hovering "in" the middle of the item → become a child */}
        {isOver && dropMode === 'inside' && (
          <div className="pointer-events-none absolute inset-0 z-10 rounded-2xl bg-[var(--accent)]/12 ring-2 ring-inset ring-[var(--accent)]/40" />
        )}
        {/* AFTER: bottom gradient wash + sharp bottom edge line */}
        {isOver && dropMode === 'after' && (
          <>
            <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-1/2 rounded-b-2xl bg-gradient-to-t from-[var(--accent)]/20 to-transparent" />
            <div className="pointer-events-none absolute bottom-0 z-20 h-[3px] rounded-r-full bg-[var(--accent)]" style={{ left: `${16 + depth * 24}px`, right: 0 }} />
          </>
        )}
        <div className={`relative flex items-center gap-2 px-4 ${compact ? 'py-1.5' : 'py-2'}`} style={{ paddingLeft: `${16 + (depth * 24)}px` }}>
          <div className="absolute top-1/2 -translate-y-1/2 cursor-grab text-[var(--text-muted)]" style={{ left: `${depth * 24 - 10}px` }}>
            <GripVertical size={12} className="opacity-0 transition-opacity group-hover:opacity-100" />
          </div>
          <div className="flex w-5 shrink-0 items-center justify-center text-[var(--text-muted)]">
            {hasChildren ? (
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onToggleCollapsed(task.id);
                }}
                className="rounded p-0.5 transition-colors hover:bg-[var(--panel-alt-bg)] hover:text-[var(--text-primary)]"
                aria-label={task.collapsed ? 'Expand subtasks' : 'Collapse subtasks'}
              >
                {task.collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
              </button>
            ) : (
              <div className="h-1.5 w-1.5 rounded-full bg-[var(--text-muted)]/70" />
            )}
          </div>

          <TaskCheckbox checked={task.status === 'completed'} onToggle={() => onToggleComplete(task.id)} className={compact ? 'h-4 w-4' : 'h-[18px] w-[18px]'} />

          <div className="min-w-0 flex-1 cursor-pointer" onClick={handleRowClick} onDoubleClick={handleTitleDoubleClick}>
            <div className="flex items-center gap-2">
              {isEditingTitle ? (
                <input
                  autoFocus
                  value={draftTitle}
                  onChange={(event) => setDraftTitle(event.target.value)}
                  onClick={(event) => event.stopPropagation()}
                  onBlur={commitTitleEdit}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      commitTitleEdit();
                    }
                    if (event.key === 'Escape') {
                      event.preventDefault();
                      setDraftTitle(task.title);
                      setIsEditingTitle(false);
                    }
                  }}
                  className={`w-full bg-transparent p-0 tracking-[-0.01em] text-[var(--text-primary)] outline-none border-none focus:ring-0 ${compact ? 'text-[12.5px]' : 'text-[13px]'}`}
                />
              ) : (
                <span
                  className={`truncate tracking-[-0.01em] ${compact ? 'text-[12.5px]' : 'text-[13px]'} ${task.status === 'completed' ? `text-[var(--text-muted)] brutal-strike-line ${isJustCompleted ? 'animate-strike' : ''}` : 'text-[var(--text-primary)]'}`}
                >
                  {task.title}
                </span>
              )}
            </div>
            {(task.projectId || task.tags.length > 0) && (
              <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-[var(--text-muted)]">
                {task.projectId && <span className="font-medium opacity-80">{projects.find((project) => project.id === task.projectId)?.name || 'Project'}</span>}
                {task.tags.slice(0, 3).map((tag) => <span key={tag} className="opacity-60">#{tag}</span>)}
              </div>
            )}
          </div>

          <div className="ml-auto flex items-center gap-3">
            <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
              <TaskTimerDot taskId={task.id} />
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onToggleStar(task.id);
                }}
                className={`rounded p-1 transition-colors hover:bg-[var(--panel-alt-bg)] ${task.isStarred ? 'text-yellow-400' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}
                aria-label="Toggle star"
              >
                <Star size={14} fill={task.isStarred ? 'currentColor' : 'none'} />
              </button>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onOutdent(task.id);
                }}
                disabled={!canOutdent}
                className="rounded p-1 text-[var(--text-muted)] transition-colors hover:bg-[var(--panel-alt-bg)] hover:text-[var(--text-primary)] disabled:cursor-not-allowed disabled:opacity-30"
                aria-label="Outdent task"
              >
                <ArrowLeft size={14} />
              </button>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onIndent(task.id);
                }}
                disabled={!canIndent}
                className="rounded p-1 text-[var(--text-muted)] transition-colors hover:bg-[var(--panel-alt-bg)] hover:text-[var(--text-primary)] disabled:cursor-not-allowed disabled:opacity-30"
                aria-label="Indent task"
              >
                <ArrowRight size={14} />
              </button>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onMoveUp(task.id);
                }}
                disabled={!canMoveUp}
                className="rounded p-1 text-[var(--text-muted)] transition-colors hover:bg-[var(--panel-alt-bg)] hover:text-[var(--text-primary)] disabled:cursor-not-allowed disabled:opacity-30"
                aria-label="Move task up"
              >
                <ChevronUpIcon />
              </button>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onMoveDown(task.id);
                }}
                disabled={!canMoveDown}
                className="rounded p-1 text-[var(--text-muted)] transition-colors hover:bg-[var(--panel-alt-bg)] hover:text-[var(--text-primary)] disabled:cursor-not-allowed disabled:opacity-30"
                aria-label="Move task down"
              >
                <ChevronDownIcon />
              </button>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onOpenTask(task);
                }}
                className="rounded p-1 text-[var(--text-muted)] transition-colors hover:bg-[var(--panel-alt-bg)] hover:text-[var(--text-primary)]"
                aria-label="Open task"
              >
                <ExternalLink size={14} />
              </button>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              {task.description.trim() && <AlignLeft size={13} strokeWidth={1.5} className="text-[var(--text-muted)] opacity-60" />}
              {childCount > 0 && (
                <span className="rounded-full bg-[var(--panel-alt-bg)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.06em] text-[var(--text-muted)] shrink-0">
                  {childCount}
                </span>
              )}
              {isContextAncestor && (
                <span className="rounded-full bg-[var(--accent-soft)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.06em] text-[var(--accent)] shrink-0">
                  Context
                </span>
              )}
            </div>
          </div>

        </div>

      </div>
    );
  };

const ChevronUpIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="m18 15-6-6-6 6" />
  </svg>
);

const ChevronDownIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="m6 9 6 6 6-6" />
  </svg>
);
