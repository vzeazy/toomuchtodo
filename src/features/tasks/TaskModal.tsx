import React, { useEffect, useMemo, useState } from 'react';
import { Star, Trash2, X, Plus, CornerDownRight, AlignLeft, ChevronDown, ChevronRight, Pencil } from 'lucide-react';
import { SmartSelect } from '../../components/SmartSelect';
import { TaskCheckbox } from '../../components/TaskCheckbox';
import { renderMarkdown } from '../../lib/markdown';
import { DayPart, Project, Task, TaskStatus } from '../../types';
import { canReparentTask } from './taskTree';

const AREAS = ['Personal', 'Work', 'Leisure', 'Finance'];
const DAY_PARTS: Array<{ value: DayPart; label: string }> = [
  { value: 'morning', label: 'Morning' },
  { value: 'afternoon', label: 'Afternoon' },
  { value: 'evening', label: 'Evening' },
];
const TASK_STATUSES: Array<{ value: TaskStatus; label: string }> = [
  { value: 'open', label: 'Open' },
  { value: 'next', label: 'Next' },
  { value: 'waiting', label: 'Waiting' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'someday', label: 'Someday' },
  { value: 'inbox', label: 'Inbox' },
];

export const TaskModal: React.FC<{
  task: Task;
  tasks: Task[];
  projects: Project[];
  onClose: () => void;
  onUpdate: (id: string, updates: Partial<Task>) => void;
  onSetParent: (id: string, parentId: string | null) => void;
  onDelete: (id: string) => void;
  onToggleStar: (id: string) => void;
  onToggleComplete: (id: string) => void;
  onMoveTaskBefore: (sourceId: string, targetId: string, parentId: string | null) => void;
  onMoveTaskAfter: (sourceId: string, targetId: string, parentId: string | null) => void;
  onAddSubtask?: (parentTask: Task, title: string) => void;
  onOpenTask?: (task: Task) => void;
}> = ({ task, tasks, projects, onClose, onUpdate, onSetParent, onDelete, onToggleStar, onToggleComplete, onMoveTaskBefore, onMoveTaskAfter, onAddSubtask, onOpenTask }) => {
  const [isAddingSubtask, setIsAddingSubtask] = useState(false);
  const [draftSubtaskTitle, setDraftSubtaskTitle] = useState('');
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [isNotesExpanded, setIsNotesExpanded] = useState(false);
  const [isMetaExpanded, setIsMetaExpanded] = useState(false);
  const [dragTarget, setDragTarget] = useState<string | null>(null);
  const [isDraggingSubtask, setIsDraggingSubtask] = useState(false);

  const tagValue = useMemo(() => task.tags.join(', '), [task.tags]);
  const subtasks = useMemo(() => tasks.filter((t) => t.parentId === task.id), [tasks, task.id]);
  const hasNotes = task.description.trim().length > 0;
  const noteLineCount = useMemo(() => task.description.split('\n').length, [task.description]);
  const shouldCollapseNotes = task.description.length > 460 || noteLineCount > 10;
  const statusLabel = useMemo(() => TASK_STATUSES.find((status) => status.value === task.status)?.label || 'Open', [task.status]);
  const dayBlockLabel = useMemo(() => DAY_PARTS.find((part) => part.value === task.dayPart)?.label || 'No Block', [task.dayPart]);
  const projectLabel = useMemo(() => projects.find((project) => project.id === task.projectId)?.name || 'No Project', [projects, task.projectId]);
  const parentLabel = useMemo(() => tasks.find((candidate) => candidate.id === task.parentId)?.title || 'Top level', [task.parentId, tasks]);
  const availableParents = useMemo(
    () => tasks.filter((candidate) => candidate.id !== task.id && canReparentTask(task.id, candidate.id, tasks)),
    [task.id, tasks],
  );

  useEffect(() => {
    setIsEditingNotes(false);
    setIsNotesExpanded(false);
    setIsMetaExpanded(false);
    setDragTarget(null);
    setIsDraggingSubtask(false);
  }, [task.id]);

  useEffect(() => {
    if (!isDraggingSubtask) return;
    const handleDragEnd = () => setIsDraggingSubtask(false);
    window.addEventListener('dragend', handleDragEnd);
    window.addEventListener('drop', handleDragEnd);
    return () => {
      window.removeEventListener('dragend', handleDragEnd);
      window.removeEventListener('drop', handleDragEnd);
    };
  }, [isDraggingSubtask]);

  const commitSubtask = (keepOpen = false) => {
    const nextTitle = draftSubtaskTitle.trim();
    if (!nextTitle) {
      setIsAddingSubtask(false);
      setDraftSubtaskTitle('');
      return;
    }
    if (onAddSubtask) onAddSubtask(task, nextTitle);
    setDraftSubtaskTitle('');
    setIsAddingSubtask(keepOpen);
  };

  const detachSubtask = (subtaskId: string, updates?: Partial<Task>) => {
    onSetParent(subtaskId, null);
    if (updates) onUpdate(subtaskId, updates);
  };

  return (
    <div
      className={`fixed inset-0 z-[2100] flex justify-end transition-opacity ${isDraggingSubtask ? 'bg-transparent backdrop-blur-0 pointer-events-none' : 'bg-[var(--overlay)] backdrop-blur-[2px]'}`}
      onClick={onClose}
    >
      <div
        className="panel-surface flex h-full w-full max-w-[500px] flex-col shadow-[-10px_0_40px_rgba(0,0,0,0.1)] border-l soft-divider animate-in slide-in-from-right duration-200 pointer-events-auto"
        onClick={(event) => event.stopPropagation()}
      >

        {/* Header - Seamless */}
        <div className="flex shrink-0 items-center justify-between px-8 pb-4 pt-7">
          <div className="flex items-center gap-3">
            <TaskCheckbox checked={task.status === 'completed'} onToggle={() => onToggleComplete(task.id)} />
            <button type="button" onClick={() => onToggleStar(task.id)} className={`transition-colors hover:scale-110 active:scale-95 ${task.isStarred ? 'text-yellow-400' : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'}`}>
              <Star size={18} fill={task.isStarred ? 'currentColor' : 'none'} />
            </button>
            <span className="ml-1 text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--text-muted)] opacity-70">Task</span>
          </div>
          <button type="button" onClick={onClose} className="rounded-full p-1.5 text-[var(--text-muted)] transition-colors hover:bg-[rgba(255,255,255,0.05)] hover:text-[var(--text-primary)]">
            <X size={18} />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto px-8 pb-4">
          <div className="mb-6">
            <input
              type="text"
              value={task.title}
              onChange={(event) => onUpdate(task.id, { title: event.target.value })}
              className="w-full select-all bg-transparent text-[22px] font-semibold leading-[1.2] tracking-[-0.02em] text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)]"
              placeholder="Task title..."
            />
          </div>

          <div className="mb-6">
            <div className="mb-2 flex items-center justify-between">
              <label className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--text-muted)] opacity-70">Notes</label>
              <div className="flex items-center gap-2">
                {!isEditingNotes && hasNotes && shouldCollapseNotes && (
                  <button
                    type="button"
                    onClick={() => setIsNotesExpanded((value) => !value)}
                    className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)]"
                  >
                    {isNotesExpanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                    {isNotesExpanded ? 'Collapse' : 'Expand'}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsEditingNotes((value) => !value)}
                  className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)]"
                >
                  <Pencil size={11} />
                  {isEditingNotes ? 'Done' : hasNotes ? 'Edit' : 'Add'}
                </button>
              </div>
            </div>
            {!isEditingNotes && !hasNotes ? (
              <button
                type="button"
                onClick={() => setIsEditingNotes(true)}
                className="w-full rounded-xl border border-dashed soft-divider px-3 py-2.5 text-left text-[12px] text-[var(--text-muted)] transition-colors hover:border-[var(--accent)] hover:text-[var(--text-secondary)]"
              >
                Add notes for execution details or checklists
              </button>
            ) : isEditingNotes ? (
              <textarea
                value={task.description}
                onChange={(event) => onUpdate(task.id, { description: event.target.value })}
                placeholder="Use markdown for headings, checklists, and execution notes."
                className={`markdown-preview w-full resize-y rounded-xl bg-[rgba(255,255,255,0.02)] p-3 text-[12px] leading-relaxed text-[var(--text-secondary)] outline-none placeholder:text-[var(--text-muted)] ${hasNotes ? 'min-h-[140px]' : 'min-h-[88px]'}`}
                spellCheck={false}
              />
            ) : (
              <div className="relative overflow-hidden rounded-xl bg-[rgba(255,255,255,0.02)] p-3">
                <div
                  className={`markdown-preview text-[12px] leading-relaxed text-[var(--text-secondary)] ${shouldCollapseNotes && !isNotesExpanded ? 'max-h-[180px] overflow-hidden' : ''}`}
                  dangerouslySetInnerHTML={{ __html: renderMarkdown(task.description) }}
                />
                {shouldCollapseNotes && !isNotesExpanded && (
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-[var(--panel-bg)] to-transparent" />
                )}
              </div>
            )}
          </div>

          {(subtasks.length > 0 || isAddingSubtask) && (
            <div className="mb-8">
              <div className="mb-3 flex items-center justify-between">
                <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--text-muted)] opacity-70">Subtasks</div>
                {!isAddingSubtask && (
                  <button
                    type="button"
                    onClick={() => setIsAddingSubtask(true)}
                    className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)]"
                  >
                    <Plus size={11} />
                    Add
                  </button>
                )}
              </div>
              <div className="space-y-1.5 pt-1">
                {subtasks.map((subtask) => (
                  <React.Fragment key={subtask.id}>
                    <SubtaskDropZone
                      active={dragTarget === `before:${subtask.id}`}
                      onDragEnter={() => setDragTarget(`before:${subtask.id}`)}
                      onDragLeave={() => setDragTarget((value) => value === `before:${subtask.id}` ? null : value)}
                      onDrop={(sourceId) => onMoveTaskBefore(sourceId, subtask.id, task.id)}
                    />
                    <button
                      type="button"
                      draggable
                      onDragStart={(event) => {
                        event.dataTransfer.setData('taskId', subtask.id);
                        event.dataTransfer.setData('context', 'reorder');
                        setIsDraggingSubtask(true);
                      }}
                      onDragEnd={() => setIsDraggingSubtask(false)}
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={(event) => {
                        event.preventDefault();
                        setIsDraggingSubtask(false);
                        const sourceId = event.dataTransfer.getData('taskId');
                        if (!sourceId || sourceId === subtask.id) return;
                        onMoveTaskAfter(sourceId, subtask.id, task.id);
                      }}
                      onClick={() => onOpenTask && onOpenTask(subtask)}
                      className="flex w-full items-center gap-3 rounded-xl px-2 py-1.5 text-left transition-colors hover:bg-[rgba(255,255,255,0.03)]"
                    >
                      <TaskCheckbox checked={subtask.status === 'completed'} onToggle={() => onToggleComplete(subtask.id)} />
                      <span className={`block flex-1 truncate text-[13px] tracking-[-0.01em] ${subtask.status === 'completed' ? 'text-[var(--text-muted)] line-through' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}>{subtask.title}</span>
                      {subtask.description.trim() && <AlignLeft size={13} strokeWidth={1.5} className="ml-auto shrink-0 text-[var(--text-muted)] opacity-60" />}
                    </button>
                  </React.Fragment>
                ))}
                {subtasks.length > 0 && (
                  <SubtaskDropZone
                    active={dragTarget === 'tail'}
                    onDragEnter={() => setDragTarget('tail')}
                    onDragLeave={() => setDragTarget((value) => value === 'tail' ? null : value)}
                    onDrop={(sourceId) => onMoveTaskAfter(sourceId, subtasks[subtasks.length - 1].id, task.id)}
                  />
                )}
                {isAddingSubtask && (
                  <div className="flex items-center gap-2 rounded-xl border soft-divider bg-[var(--panel-alt-bg)] px-2 py-1.5 transition-colors focus-within:border-[var(--accent)]">
                    <CornerDownRight size={13} className="shrink-0 text-[var(--text-muted)]" />
                    <input
                      autoFocus
                      value={draftSubtaskTitle}
                      onChange={(event) => setDraftSubtaskTitle(event.target.value)}
                      onBlur={() => commitSubtask(false)}
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
                      placeholder="New subtask..."
                      className="w-full bg-transparent px-1 text-[13px] text-[var(--text-primary)] outline-none"
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {!isAddingSubtask && subtasks.length === 0 && (
            <button
              type="button"
              onClick={() => setIsAddingSubtask(true)}
              className="mb-8 flex items-center gap-2 text-[12px] font-medium text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)]"
            >
              <Plus size={14} /> Add subtask
            </button>
          )}
        </div>

        <div className="shrink-0 border-t soft-divider px-8 py-4">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setIsMetaExpanded(true)}
                className="rounded-full bg-[rgba(255,255,255,0.05)] px-2.5 py-1 text-[11px] font-medium text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
              >
                Status: {statusLabel}
              </button>
              <button
                type="button"
                onClick={() => setIsMetaExpanded(true)}
                className="rounded-full bg-[rgba(255,255,255,0.05)] px-2.5 py-1 text-[11px] font-medium text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
              >
                Due: {task.dueDate || 'No date'}
              </button>
              <button
                type="button"
                onClick={() => setIsMetaExpanded(true)}
                className="rounded-full bg-[rgba(255,255,255,0.05)] px-2.5 py-1 text-[11px] font-medium text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
              >
                Project: {projectLabel}
              </button>
              <button
                type="button"
                onClick={() => setIsMetaExpanded((value) => !value)}
                className="ml-auto flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)]"
              >
                {isMetaExpanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                {isMetaExpanded ? 'Hide details' : 'More fields'}
              </button>
            </div>

            {(isMetaExpanded || dragTarget === 'detach') && (
              <div
                className="rounded-xl border border-dashed border-[var(--border-color)] px-3 py-2 text-[11px] text-[var(--text-muted)]"
                onDragOver={(event) => {
                  event.preventDefault();
                  setDragTarget('detach');
                }}
                onDragLeave={() => setDragTarget((value) => value === 'detach' ? null : value)}
                onDrop={(event) => {
                  event.preventDefault();
                  setDragTarget(null);
                  const sourceId = event.dataTransfer.getData('taskId');
                  if (!sourceId) return;
                  detachSubtask(sourceId, { projectId: task.projectId, area: task.area });
                }}
                style={dragTarget === 'detach' ? { borderColor: 'var(--accent)', background: 'var(--accent-soft)' } : undefined}
              >
                Drop subtask here to make it a top-level task.
              </div>
            )}

            {isMetaExpanded && (
              <div className="space-y-3 rounded-xl bg-[rgba(255,255,255,0.02)] p-3">
                <div className="grid gap-4 sm:grid-cols-2">
              <div
                onDragOver={(event) => {
                  event.preventDefault();
                  setDragTarget('project');
                }}
                onDragLeave={() => setDragTarget((value) => value === 'project' ? null : value)}
                onDrop={(event) => {
                  event.preventDefault();
                  setDragTarget(null);
                  const sourceId = event.dataTransfer.getData('taskId');
                  if (!sourceId) return;
                  detachSubtask(sourceId, { projectId: task.projectId });
                }}
                className={`rounded-lg ${dragTarget === 'project' ? 'bg-[var(--accent-soft)]' : ''}`}
              >
                <label className="mb-1 block text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--text-muted)] opacity-70">Project</label>
                <SmartSelect
                  className="w-full bg-transparent px-0 py-1.5 text-[14px] font-medium text-[var(--text-primary)] outline-none transition-colors hover:text-[var(--accent)] focus:text-[var(--accent)]"
                  value={task.projectId || ''}
                  onChange={(val) => onUpdate(task.id, { projectId: val || null })}
                  options={[
                    ...projects.map((p) => ({ value: p.id, label: p.name }))
                  ]}
                  placeholder="No Project"
                />
              </div>

              <div
                onDragOver={(event) => {
                  event.preventDefault();
                  setDragTarget('area');
                }}
                onDragLeave={() => setDragTarget((value) => value === 'area' ? null : value)}
                onDrop={(event) => {
                  event.preventDefault();
                  setDragTarget(null);
                  const sourceId = event.dataTransfer.getData('taskId');
                  if (!sourceId) return;
                  detachSubtask(sourceId, { area: task.area });
                }}
                className={`rounded-lg ${dragTarget === 'area' ? 'bg-[var(--accent-soft)]' : ''}`}
              >
                <label className="mb-1 block text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--text-muted)] opacity-70">Area</label>
                <SmartSelect
                  className="w-full bg-transparent px-0 py-1.5 text-[14px] font-medium text-[var(--text-primary)] outline-none transition-colors hover:text-[var(--accent)] focus:text-[var(--accent)]"
                  value={task.area}
                  onChange={(val) => onUpdate(task.id, { area: val })}
                  options={AREAS.map((a) => ({ value: a, label: a }))}
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--text-muted)] opacity-70">Parent Task</label>
              <SmartSelect
                className="w-full bg-transparent px-0 py-1.5 text-[14px] font-medium text-[var(--text-primary)] outline-none transition-colors hover:text-[var(--accent)] focus:text-[var(--accent)]"
                value={task.parentId || ''}
                onChange={(val) => onSetParent(task.id, val || null)}
                options={[
                  ...availableParents.map((t) => ({ value: t.id, label: t.title }))
                ]}
                placeholder="Top level"
              />
              <div className="mt-1 text-[10px] text-[var(--text-muted)]">Current: {parentLabel}</div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--text-muted)] opacity-70">Status</label>
                <SmartSelect
                  className="w-full bg-transparent px-0 py-1.5 text-[14px] font-medium text-[var(--text-primary)] outline-none transition-colors hover:text-[var(--accent)] focus:text-[var(--accent)]"
                  value={task.status === 'completed' ? 'open' : task.status}
                  onChange={(val) => onUpdate(task.id, { status: val as TaskStatus })}
                  options={TASK_STATUSES}
                />
              </div>

              <div>
                <label className="mb-1 block text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--text-muted)] opacity-70">Due Date</label>
                <input
                  type="date"
                  value={task.dueDate || ''}
                  onChange={(event) => onUpdate(task.id, { dueDate: event.target.value || null, status: event.target.value ? 'scheduled' : (task.status === 'scheduled' ? (task.projectId ? 'open' : 'next') : task.status) })}
                  className="w-full bg-transparent px-0 py-1.5 text-[14px] font-medium text-[var(--text-primary)] outline-none transition-colors hover:text-[var(--accent)] focus:text-[var(--accent)] [color-scheme:dark]"
                />
              </div>

              <div>
                <label className="mb-1 block text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--text-muted)] opacity-70">Day Block</label>
                <SmartSelect
                  className="w-full bg-transparent px-0 py-1.5 text-[14px] font-medium text-[var(--text-primary)] outline-none transition-colors hover:text-[var(--accent)] focus:text-[var(--accent)]"
                  value={task.dayPart || ''}
                  onChange={(val) => onUpdate(task.id, { dayPart: (val as DayPart) || null })}
                  options={DAY_PARTS}
                  placeholder="No Block"
                />
                <div className="mt-1 text-[10px] text-[var(--text-muted)]">Current: {dayBlockLabel}</div>
              </div>

              <div>
                <label className="mb-1 block text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--text-muted)] opacity-70">Tags</label>
                <input
                  type="text"
                  value={tagValue}
                  onChange={(event) => onUpdate(task.id, { tags: event.target.value.split(',').map((tag) => tag.trim()).filter(Boolean) })}
                  placeholder="tag1, tag2..."
                  className="w-full bg-transparent px-0 py-1.5 text-[14px] font-medium text-[var(--text-primary)] outline-none transition-colors placeholder:font-normal placeholder:text-[var(--text-muted)] hover:text-[var(--accent)] focus:text-[var(--accent)]"
                />
              </div>
            </div>

            {task.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {task.tags.map((tag) => (
                  <span key={tag} className="flex h-[22px] items-center rounded-md bg-[rgba(255,255,255,0.06)] px-2 text-[10.5px] font-bold text-[var(--text-secondary)]">
                    <span className="mr-0.5 opacity-40">#</span>{tag}
                  </span>
                ))}
              </div>
            )}
              </div>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center justify-between px-8 pb-7 pt-4">
          <button type="button" onClick={() => { onDelete(task.id); onClose(); }} className="flex h-[32px] items-center gap-1.5 rounded-lg px-2 text-[11px] font-bold tracking-[0.04em] text-[var(--danger)] opacity-80 transition-all hover:bg-[rgba(255,0,0,0.1)] hover:opacity-100">
            <Trash2 size={13} strokeWidth={2.5} /> Delete
          </button>

          <button type="button" onClick={onClose} className="flex h-[34px] items-center justify-center rounded-xl bg-[var(--text-primary)] px-5 text-[12px] font-bold tracking-[0.02em] text-[var(--panel-bg)] shadow-[0_4px_10px_rgba(0,0,0,0.2)] transition-all hover:scale-105 active:scale-95">
            Done
          </button>
        </div>

      </div>
    </div>
  );
};

const SubtaskDropZone: React.FC<{
  active: boolean;
  onDragEnter: () => void;
  onDragLeave: () => void;
  onDrop: (sourceId: string) => void;
}> = ({ active, onDragEnter, onDragLeave, onDrop }) => (
  <div
    className="relative h-2"
    onDragEnter={() => onDragEnter()}
    onDragLeave={() => onDragLeave()}
    onDragOver={(event) => event.preventDefault()}
    onDrop={(event) => {
      event.preventDefault();
      onDragLeave();
      const sourceId = event.dataTransfer.getData('taskId');
      if (sourceId) onDrop(sourceId);
    }}
  >
    <div className={`absolute inset-x-2 top-1/2 h-px -translate-y-1/2 transition-colors ${active ? 'bg-[var(--accent)]' : 'bg-transparent'}`} />
  </div>
);
