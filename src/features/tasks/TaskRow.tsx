import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2, CornerDownRight, ExternalLink, GripVertical, MoreVertical, AlignLeft, Plus, Star, Trash2 } from 'lucide-react';
import { TaskCheckbox } from '../../components/TaskCheckbox';
import { Project, Task } from '../../types';

export const TaskRow: React.FC<{
  task: Task;
  allTasks: Task[];
  projects: Project[];
  childCount?: number;
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
}> = ({ task, allTasks, projects, childCount = 0, onToggleStar, onToggleComplete, onUpdate, onMoveBefore, onMoveAfter, onNestInto, onDelete, onOpenTask, canNestTask, onAddSubtask }) => {
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

    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('resize', handleViewportChange);
    window.addEventListener('scroll', handleViewportChange, true);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('resize', handleViewportChange);
      window.removeEventListener('scroll', handleViewportChange, true);
    };
  }, [showMenu, updateMenuPosition]);

  const handleDragStart = (event: React.DragEvent) => {
    event.dataTransfer.setData('taskId', task.id);
    event.dataTransfer.setData('context', 'reorder');
    event.dataTransfer.effectAllowed = 'move';
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

  const subtasks = allTasks.filter((item) => item.parentId === task.id);

  return (
    <div
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
      className={`group relative flex flex-col transition-all rounded-xl hover:bg-[rgba(255,255,255,0.015)] ${isOver && dropMode === 'inside' ? 'ring-2 ring-inset ring-[var(--accent)] bg-[var(--accent-soft)] z-10' : ''} ${isJustCompleted ? 'brutal-row-bounce' : ''}`}
    >
      {isOver && dropMode === 'before' && <div className="absolute inset-x-0 top-0 z-20 h-[2px] bg-[var(--accent)] shadow-[0_0_8px_var(--accent)]" />}
      {isOver && dropMode === 'after' && <div className="absolute inset-x-0 bottom-0 z-20 h-[2px] bg-[var(--accent)] shadow-[0_0_8px_var(--accent)]" />}
      <div
        className="relative flex cursor-pointer items-center gap-3 pl-0 pr-5 py-2.5"
        onClick={handleRowClick}
        onDoubleClick={handleTitleDoubleClick}
      >
        <div className="absolute -left-4 top-1/2 -translate-y-1/2 cursor-grab text-[var(--text-muted)] opacity-0 transition-opacity group-hover:opacity-100">
          <GripVertical size={13} />
        </div>
        <TaskCheckbox checked={task.status === 'completed'} onToggle={() => onToggleComplete(task.id)} className="h-[18px] w-[18px]" />

        <div className="min-w-0 flex-1">
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
                className="w-full rounded bg-transparent text-[13px] font-normal tracking-[-0.01em] text-[var(--text-primary)] outline-none ring-1 ring-[var(--focus)]"
              />
            ) : (
              <span
                className={`truncate text-[13px] font-normal tracking-[-0.01em] ${task.status === 'completed' ? `text-[var(--text-muted)] brutal-strike-line ${isJustCompleted ? 'animate-strike' : ''}` : 'text-[var(--text-primary)]'}`}
              >
                {task.title}
              </span>
            )}
            {task.description.trim() && <AlignLeft size={14} strokeWidth={1.5} className="ml-auto shrink-0 text-[var(--text-muted)] opacity-60" title="Task has notes" />}
          </div>
          {(task.tags.length > 0 || task.projectId) && (
            <div className="mt-1 flex flex-wrap gap-2 text-[11px]">
              {task.tags.slice(0, 3).map((tag) => <span key={tag} className="text-[var(--text-muted)]">#{tag}</span>)}
              {task.projectId && (
                <span className="text-[var(--text-muted)]">
                  {projects.find((project) => project.id === task.projectId)?.name || 'Project'}
                </span>
              )}
              {childCount > 0 && <span className="text-[var(--text-muted)]">{childCount} subtask{childCount === 1 ? '' : 's'}</span>}
            </div>
          )}
          {childCount > 0 && task.tags.length === 0 && !task.projectId && (
            <div className="mt-1 text-[11px] text-[var(--text-muted)]">{childCount} subtask{childCount === 1 ? '' : 's'}</div>
          )}
        </div>

        <div className={`flex items-center gap-1 transition-opacity ${task.isStarred ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
          <button
            type="button"
            onClick={(event) => { event.stopPropagation(); onToggleStar(task.id); }}
            className={`rounded p-1 transition-colors hover:bg-[var(--panel-alt-bg)] ${task.isStarred ? 'text-yellow-400' : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'}`}
          >
            <Star size={16} fill={task.isStarred ? 'currentColor' : 'none'} />
          </button>
          <button
            ref={menuButtonRef}
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              updateMenuPosition();
              setShowMenu((prev) => !prev);
            }}
            className={`rounded p-1 transition-colors hover:bg-[var(--panel-alt-bg)] ${showMenu ? 'text-[var(--text-primary)]' : 'text-[var(--text-muted)]'}`}
          >
            <MoreVertical size={14} />
          </button>
        </div>
      </div>

      {showMenu && createPortal(
        <div ref={menuRef} className="fixed z-[2300] w-56 overflow-hidden rounded-xl border border-[var(--border-color)] bg-[var(--elevated-bg)] shadow-2xl" style={{ top: menuPosition.top, left: menuPosition.left }}>
          <button type="button" onClick={(event) => { event.stopPropagation(); onOpenTask(task); setShowMenu(false); }} className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-[var(--text-primary)] transition-colors hover:bg-[var(--panel-bg)]">
            <ExternalLink size={13} /> Open task
          </button>
          <div className="my-1 border-t border-[var(--border-color)]" />
          <div className="bg-[var(--panel-alt-bg)] px-3 py-1.5 text-[10px] font-bold uppercase text-[var(--text-muted)]">Project</div>
          {projects.slice(0, 6).map((project) => (
            <button key={project.id} type="button" onClick={(event) => { event.stopPropagation(); onUpdate(task.id, { projectId: project.id }); setShowMenu(false); }} className="flex w-full items-center justify-between px-3 py-2 text-left text-xs text-[var(--text-primary)] transition-colors hover:bg-[var(--panel-bg)]">
              <span className="truncate">{project.name}</span>
              {task.projectId === project.id && <CheckCircle2 size={12} className="text-[var(--accent)]" />}
            </button>
          ))}
          <div className="my-1 border-t border-[var(--border-color)]" />
          <button type="button" onClick={(event) => { event.stopPropagation(); onDelete(task.id); setShowMenu(false); }} className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-[var(--danger)] transition-colors hover:bg-[var(--danger-soft)]">
            <Trash2 size={12} /> Delete
          </button>
        </div>,
        document.body
      )}
    </div>
  );
};
