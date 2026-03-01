import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2, CornerDownRight, ExternalLink, GripVertical, MoreVertical, NotebookPen, Plus, Star, Trash2 } from 'lucide-react';
import { MarkdownEditor } from '../../components/MarkdownEditor';
import { TaskCheckbox } from '../../components/TaskCheckbox';
import { renderMarkdown } from '../../lib/markdown';
import { Project, Task } from '../../types';

export const TaskRow: React.FC<{
  task: Task;
  allTasks: Task[];
  projects: Project[];
  childCount?: number;
  isExpanded: boolean;
  onToggleStar: (id: string) => void;
  onToggleComplete: (id: string) => void;
  onUpdate: (id: string, updates: Partial<Task>) => void;
  onMoveBefore: (sourceId: string, targetId: string) => void;
  onMoveAfter: (sourceId: string, targetId: string) => void;
  onNestInto: (sourceId: string, targetId: string) => void;
  onDelete: (id: string) => void;
  onSelect: (id: string | null) => void;
  onOpenTask: (task: Task) => void;
  canNestTask: (sourceId: string, targetId: string) => boolean;
  onAddSubtask: (parentTask: Task, title: string) => void;
}> = ({ task, allTasks, projects, childCount = 0, isExpanded, onToggleStar, onToggleComplete, onUpdate, onMoveBefore, onMoveAfter, onNestInto, onDelete, onSelect, onOpenTask, canNestTask, onAddSubtask }) => {
  const [showMenu, setShowMenu] = useState(false);
  const [isOver, setIsOver] = useState(false);
  const [dropMode, setDropMode] = useState<'before' | 'inside' | 'after'>('inside');
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [showNotesEditor, setShowNotesEditor] = useState(false);
  const [isAddingSubtask, setIsAddingSubtask] = useState(false);
  const [draftSubtaskTitle, setDraftSubtaskTitle] = useState('');
  const [draftTitle, setDraftTitle] = useState(task.title);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  const menuRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const clickTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    setDraftTitle(task.title);
  }, [task.title]);

  useEffect(() => {
    if (!isExpanded) {
      setShowNotesEditor(false);
      setIsAddingSubtask(false);
      setDraftSubtaskTitle('');
    }
  }, [isExpanded]);

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
    onSelect(isExpanded ? null : task.id);
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
      className={`group relative flex flex-col transition-colors ${isExpanded ? 'bg-[rgba(255,255,255,0.02)]' : 'hover:bg-[rgba(255,255,255,0.015)]'} ${isOver && dropMode === 'inside' ? 'border-l-2 border-l-[var(--accent)] bg-[rgba(255,255,255,0.02)]' : ''}`}
    >
      {isOver && dropMode === 'before' && <div className="absolute inset-x-0 top-0 h-px bg-[var(--accent)]" />}
      {isOver && dropMode === 'after' && <div className="absolute inset-x-0 bottom-0 h-px bg-[var(--accent)]" />}
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
                className={`truncate text-[13px] font-normal tracking-[-0.01em] ${task.status === 'completed' ? 'text-[var(--text-muted)] line-through' : 'text-[var(--text-primary)]'}`}
              >
                {task.title}
              </span>
            )}
            {task.description.trim() && <NotebookPen size={14} className="shrink-0 text-[var(--text-muted)]" title="Task has notes" />}
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
            <NotebookPen size={12} /> Open task
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

      {isExpanded && (
        <div className="px-12 pb-4 pt-1" onClick={(event) => event.stopPropagation()}>
          <div className="space-y-4">
            {!showNotesEditor && task.description.trim() && (
              <button
                type="button"
                onClick={() => setShowNotesEditor(true)}
                className="block w-full text-left"
              >
                <div
                  className="markdown-preview max-h-[4.6rem] overflow-hidden text-[12px] leading-relaxed text-[var(--text-secondary)] opacity-90 transition-opacity hover:opacity-100"
                  dangerouslySetInnerHTML={{ __html: renderMarkdown(task.description) }}
                />
              </button>
            )}

            {showNotesEditor && (
              <MarkdownEditor value={task.description} onChange={(value) => onUpdate(task.id, { description: value })} minHeightClassName="min-h-[120px]" />
            )}

            {(subtasks.length > 0 || isAddingSubtask) && (
              <div>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--text-muted)]">Subtasks</div>
                  {!isAddingSubtask && (
                    <button
                      type="button"
                      onClick={() => setIsAddingSubtask(true)}
                      className="inline-flex items-center gap-1 text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)]"
                    >
                      <Plus size={11} />
                      Add
                    </button>
                  )}
                </div>
                <div className="space-y-1.5">
                  {subtasks.map((subtask) => (
                    <button
                      key={subtask.id}
                      type="button"
                      onClick={() => onOpenTask(subtask)}
                      className="flex w-full items-center gap-2 rounded-xl px-2 py-1.5 text-left transition-colors hover:bg-[rgba(255,255,255,0.03)]"
                    >
                      <TaskCheckbox checked={subtask.status === 'completed'} onToggle={() => onToggleComplete(subtask.id)} />
                      <span className={`min-w-0 flex-1 truncate text-[13px] ${subtask.status === 'completed' ? 'text-[var(--text-muted)] line-through' : 'text-[var(--text-secondary)]'}`}>{subtask.title}</span>
                      {subtask.description.trim() && <NotebookPen size={12} className="shrink-0 text-[var(--text-muted)]" />}
                    </button>
                  ))}
                  {isAddingSubtask && (
                    <div className="flex items-center gap-2 rounded-xl border border-[var(--border-color)] bg-[var(--panel-alt-bg)] px-2 py-1.5">
                      <CornerDownRight size={12} className="shrink-0 text-[var(--text-muted)]" />
                      <input
                        autoFocus
                        value={draftSubtaskTitle}
                        onChange={(event) => setDraftSubtaskTitle(event.target.value)}
                        onBlur={commitSubtask}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') {
                            event.preventDefault();
                            commitSubtask(true);
                          }
                          if (event.key === 'Escape') {
                            event.preventDefault();
                            setIsAddingSubtask(false);
                            setDraftSubtaskTitle('');
                          }
                        }}
                        placeholder="New subtask"
                        className="w-full bg-transparent text-[13px] text-[var(--text-primary)] outline-none"
                      />
                    </div>
                  )}
                </div>
              </div>
            )}

            <div>
              <div className="panel-muted inline-flex flex-wrap items-center gap-1 rounded-full border soft-divider p-1">
                <button
                  type="button"
                  onClick={() => setIsAddingSubtask(true)}
                  className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.12em] text-[var(--text-muted)] transition-colors hover:bg-[rgba(255,255,255,0.05)] hover:text-[var(--text-primary)]"
                >
                  <CornerDownRight size={12} />
                  <span>Subtask</span>
                </button>
                {!task.description.trim() && (
                  <button
                    type="button"
                    onClick={() => setShowNotesEditor(true)}
                    className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.12em] text-[var(--text-muted)] transition-colors hover:bg-[rgba(255,255,255,0.05)] hover:text-[var(--text-primary)]"
                  >
                    <Plus size={12} />
                    <span>Note</span>
                  </button>
                )}
                {showNotesEditor && (
                  <button
                    type="button"
                    onClick={() => setShowNotesEditor(false)}
                    className="inline-flex items-center gap-2 rounded-full bg-[rgba(255,255,255,0.04)] px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.12em] text-[var(--text-primary)] transition-colors hover:bg-[rgba(255,255,255,0.07)]"
                  >
                    <NotebookPen size={12} />
                    <span>Hide Note</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => onOpenTask(task)}
                  className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.12em] text-[var(--text-muted)] transition-colors hover:bg-[rgba(255,255,255,0.05)] hover:text-[var(--text-primary)]"
                >
                  <ExternalLink size={12} />
                  <span>Open</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
