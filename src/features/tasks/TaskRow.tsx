import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2, CornerDownRight, ExternalLink, GripVertical, MoreVertical, AlignLeft, Plus, Star, Trash2 } from 'lucide-react';
import { TaskCheckbox } from '../../components/TaskCheckbox';
import { TaskTimerDot } from '../../components/timer/TaskTimerDot';
import { Project, Task, TaskStatus } from '../../types';

const TASK_STATUS_OPTIONS: Array<{ value: TaskStatus; label: string }> = [
  { value: 'open', label: 'Open' },
  { value: 'next', label: 'Next' },
  { value: 'waiting', label: 'Waiting' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'someday', label: 'Someday' },
  { value: 'inbox', label: 'Inbox' },
];

export const TaskRow: React.FC<{
  task: Task;
  allTasks: Task[];
  projects: Project[];
  childCount?: number;
  compact?: boolean;
  selected?: boolean;
  selectionActive?: boolean;
  selectedTaskIds?: string[];
  onSelect?: (event: React.MouseEvent, taskId: string) => void;
  onToggleStar: (id: string) => void;
  onToggleComplete: (id: string) => void;
  onUpdate: (id: string, updates: Partial<Task>) => void;
  onMoveBefore: (sourceId: string, targetId: string) => void;
  onMoveAfter: (sourceId: string, targetId: string) => void;
  onNestInto: (sourceId: string, targetId: string) => void;
  onDelete: (id: string) => void;
  onOpenTask: (task: Task) => void;
  canNestTask: (sourceId: string, targetId: string) => boolean;
  onAddSubtask: (parentTask: Task, title: string) => void;
}> = ({ task, allTasks, projects, childCount = 0, compact = false, selected = false, selectionActive = false, selectedTaskIds = [], onSelect, onToggleStar, onToggleComplete, onUpdate, onMoveBefore, onMoveAfter, onNestInto, onDelete, onOpenTask, canNestTask, onAddSubtask }) => {
  // HTML5 drag API lowercases all type keys in dataTransfer.types
  const hasTaskDragPayload = (dataTransfer: DataTransfer) => Array.from(dataTransfer.types || []).includes('taskid');
  const rowRef = useRef<HTMLDivElement>(null);
  const [showMenu, setShowMenu] = useState(false);
  const [isOver, setIsOver] = useState(false);
  const [dropMode, setDropMode] = useState<'before' | 'inside' | 'after'>('inside');
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [showNotesEditor, setShowNotesEditor] = useState(false);
  const [isAddingSubtask, setIsAddingSubtask] = useState(false);
  const [draftSubtaskTitle, setDraftSubtaskTitle] = useState('');
  const [draftTitle, setDraftTitle] = useState(task.title);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  const [isJustCompleted, setIsJustCompleted] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const clickTimeoutRef = useRef<number | null>(null);
  const prevStatusRef = useRef(task.status);
  const ownerDocument = rowRef.current?.ownerDocument ?? document;
  const ownerWindow = ownerDocument.defaultView ?? window;

  useEffect(() => {
    setDraftTitle(task.title);
  }, [task.title]);

  useEffect(() => {
    setShowNotesEditor(false);
    setIsAddingSubtask(false);
    setDraftSubtaskTitle('');
  }, [task.id]);

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

  const updateMenuPosition = useCallback(() => {
    const button = menuButtonRef.current;
    if (!button) return;
    const rect = button.getBoundingClientRect();
    setMenuPosition({ top: rect.bottom + 8, left: Math.max(12, rect.right - 224) });
  }, []);

  useEffect(() => {
    if (!showMenu) return;

    updateMenuPosition();

    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setShowMenu(false);
    };
    const handleViewportChange = () => updateMenuPosition();

    ownerDocument.addEventListener('mousedown', handleClickOutside);
    ownerWindow.addEventListener('resize', handleViewportChange);
    ownerWindow.addEventListener('scroll', handleViewportChange, true);

    return () => {
      ownerDocument.removeEventListener('mousedown', handleClickOutside);
      ownerWindow.removeEventListener('resize', handleViewportChange);
      ownerWindow.removeEventListener('scroll', handleViewportChange, true);
    };
  }, [ownerDocument, ownerWindow, showMenu, updateMenuPosition]);

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

  const handleRowClick = (event: React.MouseEvent) => {
    if (isEditingTitle) return;
    if (selectionActive || event.metaKey || event.ctrlKey || event.shiftKey) {
      onSelect?.(event, task.id);
      return;
    }
    if (clickTimeoutRef.current) ownerWindow.clearTimeout(clickTimeoutRef.current);
    clickTimeoutRef.current = ownerWindow.setTimeout(() => {
      setDraftTitle(task.title);
      setIsEditingTitle(true);
      clickTimeoutRef.current = null;
    }, 180);
  };

  const handleTitleDoubleClick = (event: React.MouseEvent) => {
    event.stopPropagation();
    if (clickTimeoutRef.current) {
      ownerWindow.clearTimeout(clickTimeoutRef.current);
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

  const subtasks = allTasks.filter((item) => item.parentId === task.id);
  const dropModeLabel = dropMode === 'before'
    ? 'Insert above'
    : dropMode === 'after'
      ? 'Insert below'
      : 'Make subtask';

  return (
    <div
      ref={rowRef}
      data-task-row="true"
      data-task-id={task.id}
      draggable
      onDragStart={handleDragStart}
      onDragOver={(event) => {
        event.preventDefault();
        if (!hasTaskDragPayload(event.dataTransfer)) return;
        const rect = event.currentTarget.getBoundingClientRect();
        const offsetY = event.clientY - rect.top;
        const nextMode = offsetY < rect.height * 0.28 ? 'before' : offsetY > rect.height * 0.72 ? 'after' : 'inside';
        setDropMode(nextMode);
        setIsOver(true);
      }}
      onDragLeave={(event) => {
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
      className={`group relative flex flex-col rounded-xl transition-all hover:bg-[rgba(255,255,255,0.015)] ${selected ? 'bg-[var(--accent-soft)]/50 ring-1 ring-[var(--accent)]/55' : ''} ${isOver && dropMode === 'inside' ? 'bg-[var(--accent)]/10 ring-2 ring-[var(--accent)]/50' : isOver ? 'bg-[rgba(255,255,255,0.03)]' : ''} ${isJustCompleted ? 'brutal-row-bounce' : ''}`}
    >
      {/* drop intent label */}
      {isOver && (
        <div className="pointer-events-none absolute right-2 top-1/2 z-30 -translate-y-1/2 rounded-full bg-[var(--accent)] px-3 py-0.5 text-[10px] font-bold uppercase tracking-[0.1em] text-white shadow-lg">
          {dropModeLabel}
        </div>
      )}
      {/* insert-above line */}
      {isOver && dropMode === 'before' && (
        <>
          <div className="pointer-events-none absolute inset-x-2 top-0 z-20 h-[3px] rounded-full bg-[var(--accent)]" />
          <div className="pointer-events-none absolute left-2 top-[-4px] z-20 h-[10px] w-[10px] rounded-full bg-[var(--accent)] ring-2 ring-[var(--panel-bg)]" />
        </>
      )}
      {/* insert-after line */}
      {isOver && dropMode === 'after' && (
        <>
          <div className="pointer-events-none absolute inset-x-2 bottom-0 z-20 h-[3px] rounded-full bg-[var(--accent)]" />
          <div className="pointer-events-none absolute bottom-[-4px] left-2 z-20 h-[10px] w-[10px] rounded-full bg-[var(--accent)] ring-2 ring-[var(--panel-bg)]" />
        </>
      )}
      {/* nest: left accent bar */}
      {isOver && dropMode === 'inside' && (
        <div className="pointer-events-none absolute bottom-1 left-0 top-1 z-20 w-[3px] rounded-full bg-[var(--accent)]" />
      )}
      <div
        className={`relative flex cursor-pointer items-center pl-0 pr-4 ${compact ? 'gap-3 py-2' : 'gap-4 py-3'}`}
        onClick={handleRowClick}
        onDoubleClick={handleTitleDoubleClick}
      >
        <div className="absolute -left-4 top-1/2 -translate-y-1/2 cursor-grab text-[var(--text-muted)] opacity-0 transition-opacity group-hover:opacity-100">
          <GripVertical size={13} />
        </div>
        <TaskCheckbox checked={task.status === 'completed'} onToggle={() => onToggleComplete(task.id)} className={compact ? 'h-4 w-4' : 'h-[18px] w-[18px]'} />

        <div className="relative min-w-0 flex-1">
          <div className="flex items-center">
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
                className={`w-full bg-transparent p-0 font-medium tracking-[-0.01em] text-[var(--text-primary)] outline-none border-none focus:ring-0 ${compact ? 'text-[12.5px]' : 'text-[13px]'}`}
              />
            ) : (
              <span
                className={`truncate font-medium tracking-[-0.01em] ${compact ? 'text-[12.5px]' : 'text-[13px]'} ${task.status === 'completed' ? `text-[var(--text-muted)] brutal-strike-line ${isJustCompleted ? 'animate-strike' : ''}` : 'text-[var(--text-primary)]'}`}
              >
                {task.title}
              </span>
            )}
          </div>
          {(task.tags.length > 0 || task.projectId) && (
            <div className={`flex flex-wrap gap-x-3 gap-y-1 text-[11px] ${compact ? 'mt-0.5' : 'mt-1'}`}>
              {task.projectId && (
                <span className="font-medium text-[var(--text-muted)] opacity-80">
                  {projects.find((project) => project.id === task.projectId)?.name || 'Project'}
                </span>
              )}
              {task.tags.slice(0, 3).map((tag) => <span key={tag} className="text-[var(--text-muted)] opacity-60">#{tag}</span>)}
            </div>
          )}
        </div>

          <div className={`absolute right-0 top-1/2 flex -translate-y-1/2 items-center gap-1 transition-opacity ${task.isStarred || showMenu ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0 group-hover:pointer-events-auto group-hover:opacity-100'}`}>
            <TaskTimerDot taskId={task.id} taskTitle={task.title} />
            <button
              type="button"
              onClick={(event) => { event.stopPropagation(); onToggleStar(task.id); }}
              tabIndex={task.isStarred || showMenu ? 0 : -1}
              className={`rounded p-1 transition-colors hover:bg-[var(--panel-alt-bg)] ${task.isStarred ? 'text-yellow-400' : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'}`}
              title="Toggle star"
            >
              <Star size={15} fill={task.isStarred ? 'currentColor' : 'none'} />
            </button>
            <button
              ref={menuButtonRef}
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                updateMenuPosition();
                setShowMenu((prev) => !prev);
              }}
              tabIndex={task.isStarred || showMenu ? 0 : -1}
              className={`rounded p-1 transition-colors hover:bg-[var(--panel-alt-bg)] ${showMenu ? 'bg-[var(--panel-alt-bg)] text-[var(--text-primary)]' : 'text-[var(--text-muted)]'}`}
              title="Task actions"
            >
              <MoreVertical size={14} />
            </button>
          </div>

        <div className="ml-auto flex shrink-0 items-center gap-2">
          {task.description.trim() && <AlignLeft size={13} strokeWidth={1.5} className="text-[var(--text-muted)] opacity-60" />}
          {childCount > 0 && (
            <span className="rounded-full bg-[var(--panel-alt-bg)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.06em] text-[var(--text-muted)]">
              {childCount === 1 ? '1 subtask' : `${childCount} subtasks`}
            </span>
          )}
        </div>
      </div>

      {showMenu && createPortal(
        <div ref={menuRef} className="fixed z-[2300] w-56 overflow-hidden rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[var(--elevated-bg)] shadow-[0_20px_50px_rgba(0,0,0,0.5)] backdrop-blur-3xl animate-in fade-in zoom-in-95 duration-100" style={{ top: menuPosition.top, left: menuPosition.left }}>
          <div className="p-1">
            <button type="button" onClick={(event) => { event.stopPropagation(); onOpenTask(task); setShowMenu(false); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-medium text-[var(--text-primary)] transition-colors hover:bg-[rgba(255,255,255,0.06)]">
              <ExternalLink size={13} className="text-[var(--text-muted)]" /> Open details
            </button>
          </div>
          <div className="h-px bg-white/5 mx-1" />
          <div className="px-3 py-2 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--text-muted)] opacity-80">Status</div>
          <div className="p-1 pt-0">
            {TASK_STATUS_OPTIONS.map((status) => (
              <button
                key={status.value}
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onUpdate(task.id, { status: status.value });
                  setShowMenu(false);
                }}
                className="flex w-full items-center justify-between rounded-lg px-3 py-1.5 text-left text-xs text-[var(--text-primary)] transition-colors hover:bg-[rgba(255,255,255,0.06)]"
              >
                <span>{status.label}</span>
                {task.status === status.value && <CheckCircle2 size={12} className="text-[var(--accent)]" />}
              </button>
            ))}
          </div>
          <div className="h-px bg-white/5 mx-1" />
          <div className="px-3 py-2 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--text-muted)] opacity-80">Project</div>
          <div className="p-1 pt-0 max-h-48 overflow-y-auto">
            {projects.slice(0, 8).map((project) => (
              <button key={project.id} type="button" onClick={(event) => { event.stopPropagation(); onUpdate(task.id, { projectId: project.id }); setShowMenu(false); }} className="flex w-full items-center justify-between rounded-lg px-3 py-1.5 text-left text-xs text-[var(--text-primary)] transition-colors hover:bg-[rgba(255,255,255,0.06)]">
                <span className="truncate">{project.name}</span>
                {task.projectId === project.id && <CheckCircle2 size={12} className="text-[var(--accent)]" />}
              </button>
            ))}
          </div>
          <div className="h-px bg-white/5 mx-1" />
          <div className="p-1">
            <button type="button" onClick={(event) => { event.stopPropagation(); onDelete(task.id); setShowMenu(false); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-medium text-[var(--danger)] transition-colors hover:bg-[var(--danger-soft)]/20">
              <Trash2 size={13} /> Delete task
            </button>
          </div>
        </div>,
        ownerDocument.body
      )}

    </div>
  );
};
