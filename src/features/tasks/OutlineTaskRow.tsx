import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  ChevronDown,
  ChevronRight,
  CornerDownRight,
  ExternalLink,
  GripVertical,
  NotebookPen,
  Plus,
  Star,
} from 'lucide-react';
import { MarkdownEditor } from '../../components/MarkdownEditor';
import { TaskCheckbox } from '../../components/TaskCheckbox';
import { renderMarkdown } from '../../lib/markdown';
import { Project, Task } from '../../types';

export const OutlineTaskRow: React.FC<{
  task: Task;
  allTasks: Task[];
  projects: Project[];
  depth: number;
  childCount: number;
  hasChildren: boolean;
  isContextAncestor: boolean;
  isExpanded: boolean;
  canIndent: boolean;
  canOutdent: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onSelect: (id: string | null) => void;
  onToggleComplete: (id: string) => void;
  onToggleStar: (id: string) => void;
  onUpdate: (id: string, updates: Partial<Task>) => void;
  onOpenTask: (task: Task) => void;
  onToggleCollapsed: (id: string) => void;
  onIndent: (id: string) => void;
  onOutdent: (id: string) => void;
  onMoveUp: (id: string) => void;
  onMoveDown: (id: string) => void;
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
  onSelect,
  onToggleComplete,
  onToggleStar,
  onUpdate,
  onOpenTask,
  onToggleCollapsed,
  onIndent,
  onOutdent,
  onMoveUp,
  onMoveDown,
  onAddSubtask,
}) => {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [showNotesEditor, setShowNotesEditor] = useState(false);
  const [isAddingSubtask, setIsAddingSubtask] = useState(false);
  const [draftSubtaskTitle, setDraftSubtaskTitle] = useState('');
  const [draftTitle, setDraftTitle] = useState(task.title);
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
      onSelect(isExpanded ? null : task.id);
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
      tabIndex={0}
      onKeyDown={handleKeyDown}
      className={`group rounded-2xl transition-colors outline-none ${isExpanded ? 'bg-[rgba(255,255,255,0.03)]' : 'hover:bg-[rgba(255,255,255,0.018)]'} focus:bg-[rgba(255,255,255,0.025)] ${isContextAncestor ? 'opacity-75' : ''}`}
    >
      <div className="relative flex items-center gap-2 px-4 py-2" style={{ paddingLeft: `${16 + (depth * 24)}px` }}>
        <div className="absolute top-1/2 -translate-y-1/2 text-[var(--text-muted)]" style={{ left: `${depth * 24 - 10}px` }}>
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
                className={`truncate text-[13px] tracking-[-0.01em] ${task.status === 'completed' ? 'text-[var(--text-muted)] line-through' : 'text-[var(--text-primary)]'}`}
              >
                {task.title}
              </span>
            )}
            {task.description.trim() && <NotebookPen size={13} className="shrink-0 text-[var(--text-muted)]" />}
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
            <NotebookPen size={14} />
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="pb-4 pr-4" style={{ paddingLeft: `${74 + (depth * 24)}px` }} onClick={(event) => event.stopPropagation()}>
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
              <MarkdownEditor value={task.description} onChange={(value) => onUpdate(task.id, { description: value })} minHeightClassName="min-h-[110px]" />
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

            <div className="text-[10px] uppercase tracking-[0.14em] text-[var(--text-muted)]">
              Tab to indent, Shift+Tab to outdent, Alt+Arrow to move
            </div>
          </div>
        </div>
      )}
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
