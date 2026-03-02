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
import { Project, Task } from '../../types';

export const OutlineTaskRow: React.FC<{
  task: Task;
  allTasks: Task[];
  projects: Project[];
  depth: number;
  childCount: number;
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

    const handleRowClick = () => {
      if (isEditingTitle) return;
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
      event.dataTransfer.setData('taskId', task.id);
      event.dataTransfer.setData('context', 'reorder');
      event.dataTransfer.effectAllowed = 'move';
    };

    return (
      <div
        tabIndex={0}
        onKeyDown={handleKeyDown}
        draggable
        onDragStart={handleDragStart}
        onDragOver={(event) => {
          event.preventDefault();
          if (event.dataTransfer.getData('context') === 'reorder') {
            const rect = event.currentTarget.getBoundingClientRect();
            const offsetY = event.clientY - rect.top;
            const nextMode = offsetY < rect.height * 0.28 ? 'before' : offsetY > rect.height * 0.72 ? 'after' : 'inside';
            setDropMode(nextMode);
            setIsOver(true);
          }
        }}
        onDragLeave={() => {
          setIsOver(false);
          setDropMode('inside');
        }}
        onDrop={(event) => {
          event.preventDefault();
          setIsOver(false);
          const sourceId = event.dataTransfer.getData('taskId');
          if (sourceId && sourceId !== task.id && event.dataTransfer.getData('context') === 'reorder') {
            if (dropMode === 'before') onMoveBefore(sourceId, task.id);
            else if (dropMode === 'after') onMoveAfter(sourceId, task.id);
            else if (canNestTask(sourceId, task.id)) onNestInto(sourceId, task.id);
            else onMoveAfter(sourceId, task.id);
          }
          setDropMode('inside');
        }}
        className={`group relative rounded-2xl transition-colors outline-none hover:bg-[rgba(255,255,255,0.018)] focus:bg-[rgba(255,255,255,0.025)] ${isContextAncestor ? 'opacity-75' : ''} ${isOver && dropMode === 'inside' ? 'bg-[rgba(255,255,255,0.035)]' : ''} ${isJustCompleted ? 'brutal-row-bounce' : ''}`}
      >
        {isOver && dropMode === 'inside' && <div className="pointer-events-none absolute left-1 top-1/2 h-3 w-0.5 -translate-y-1/2 rounded bg-[var(--accent)]/70" />}
        {isOver && dropMode === 'before' && <div className="absolute inset-x-1 top-0 z-20 h-px bg-[var(--accent)]/80" />}
        {isOver && dropMode === 'after' && <div className="absolute inset-x-1 bottom-0 z-20 h-px bg-[var(--accent)]/80" />}
        <div className="relative flex items-center gap-2 px-4 py-2" style={{ paddingLeft: `${16 + (depth * 24)}px` }}>
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

          <TaskCheckbox checked={task.status === 'completed'} onToggle={() => onToggleComplete(task.id)} className="h-[18px] w-[18px]" />

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
                  className="w-full rounded bg-transparent text-[13px] tracking-[-0.01em] text-[var(--text-primary)] outline-none ring-1 ring-[var(--focus)]"
                />
              ) : (
                <span
                  className={`truncate text-[13px] tracking-[-0.01em] ${task.status === 'completed' ? `text-[var(--text-muted)] brutal-strike-line ${isJustCompleted ? 'animate-strike' : ''}` : 'text-[var(--text-primary)]'}`}
                >
                  {task.title}
                </span>
              )}
              {task.description.trim() && <AlignLeft size={13} strokeWidth={1.5} className="ml-auto shrink-0 text-[var(--text-muted)] opacity-60" />}
              {childCount > 0 && (
                <span className="rounded-full bg-[var(--panel-alt-bg)] px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-[var(--text-muted)]">
                  {childCount}
                </span>
              )}
              {isContextAncestor && (
                <span className="rounded-full bg-[var(--accent-soft)] px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-[var(--accent)]">
                  Context
                </span>
              )}
            </div>
            {(task.projectId || task.tags.length > 0) && (
              <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-[var(--text-muted)]">
                {task.projectId && <span>{projects.find((project) => project.id === task.projectId)?.name || 'Project'}</span>}
                {task.tags.slice(0, 3).map((tag) => <span key={tag}>#{tag}</span>)}
              </div>
            )}
          </div>

          <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
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
