import React, { useMemo, useState } from 'react';
import { Star, Trash2, X, Plus, CornerDownRight, AlignLeft } from 'lucide-react';
import { SmartSelect } from '../../components/SmartSelect';
import { MarkdownEditor } from '../../components/MarkdownEditor';
import { TaskCheckbox } from '../../components/TaskCheckbox';
import { Project, Task } from '../../types';
import { canReparentTask } from './taskTree';

const AREAS = ['Personal', 'Work', 'Leisure', 'Finance'];

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
  onAddSubtask?: (parentTask: Task, title: string) => void;
  onOpenTask?: (task: Task) => void;
}> = ({ task, tasks, projects, onClose, onUpdate, onSetParent, onDelete, onToggleStar, onToggleComplete, onAddSubtask, onOpenTask }) => {
  const [isAddingSubtask, setIsAddingSubtask] = useState(false);
  const [draftSubtaskTitle, setDraftSubtaskTitle] = useState('');

  const tagValue = useMemo(() => task.tags.join(', '), [task.tags]);
  const subtasks = useMemo(() => tasks.filter((t) => t.parentId === task.id), [tasks, task.id]);
  const availableParents = useMemo(
    () => tasks.filter((candidate) => candidate.id !== task.id && canReparentTask(task.id, candidate.id, tasks)),
    [task.id, tasks],
  );

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

  return (
    <div className="fixed inset-0 z-[2100] flex justify-end bg-[var(--overlay)] backdrop-blur-[2px] transition-opacity" onClick={onClose}>
      <div className="panel-surface flex h-full w-full max-w-[500px] flex-col shadow-[-10px_0_40px_rgba(0,0,0,0.1)] border-l soft-divider animate-in slide-in-from-right duration-200" onClick={(event) => event.stopPropagation()}>

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

          <div className="mb-8">
            <MarkdownEditor value={task.description} onChange={(value) => onUpdate(task.id, { description: value })} />
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
                  <button
                    key={subtask.id}
                    type="button"
                    onClick={() => onOpenTask && onOpenTask(subtask)}
                    className="flex w-full items-center gap-3 rounded-xl px-2 py-1.5 text-left transition-colors hover:bg-[rgba(255,255,255,0.03)]"
                  >
                    <TaskCheckbox checked={subtask.status === 'completed'} onToggle={() => onToggleComplete(subtask.id)} />
                    <span className={`block flex-1 truncate text-[13px] tracking-[-0.01em] ${subtask.status === 'completed' ? 'text-[var(--text-muted)] line-through' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}>{subtask.title}</span>
                    {subtask.description.trim() && <AlignLeft size={13} strokeWidth={1.5} className="ml-auto shrink-0 text-[var(--text-muted)] opacity-60" />}
                  </button>
                ))}
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

          <div className="space-y-5">
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label className="mb-2 block text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--text-muted)] opacity-70">Project</label>
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

              <div>
                <label className="mb-2 block text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--text-muted)] opacity-70">Area</label>
                <SmartSelect
                  className="w-full bg-transparent px-0 py-1.5 text-[14px] font-medium text-[var(--text-primary)] outline-none transition-colors hover:text-[var(--accent)] focus:text-[var(--accent)]"
                  value={task.area}
                  onChange={(val) => onUpdate(task.id, { area: val })}
                  options={AREAS.map((a) => ({ value: a, label: a }))}
                />
              </div>
            </div>

            <div>
              <label className="mb-2 block text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--text-muted)] opacity-70">Parent Task</label>
              <SmartSelect
                className="w-full bg-transparent px-0 py-1.5 text-[14px] font-medium text-[var(--text-primary)] outline-none transition-colors hover:text-[var(--accent)] focus:text-[var(--accent)]"
                value={task.parentId || ''}
                onChange={(val) => onSetParent(task.id, val || null)}
                options={[
                  ...availableParents.map((t) => ({ value: t.id, label: t.title }))
                ]}
                placeholder="Top level"
              />
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label className="mb-2 block text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--text-muted)] opacity-70">Due Date</label>
                <input
                  type="date"
                  value={task.dueDate || ''}
                  onChange={(event) => onUpdate(task.id, { dueDate: event.target.value || null, status: event.target.value ? 'scheduled' : task.status })}
                  className="w-full bg-transparent px-0 py-1.5 text-[14px] font-medium text-[var(--text-primary)] outline-none transition-colors hover:text-[var(--accent)] focus:text-[var(--accent)] [color-scheme:dark]"
                />
              </div>

              <div>
                <label className="mb-2 block text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--text-muted)] opacity-70">Tags</label>
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
              <div className="flex flex-wrap gap-1.5 pt-2">
                {task.tags.map((tag) => (
                  <span key={tag} className="flex h-[22px] items-center rounded-md bg-[rgba(255,255,255,0.06)] px-2 text-[10.5px] font-bold text-[var(--text-secondary)]">
                    <span className="mr-0.5 opacity-40">#</span>{tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer - Seamless */}
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
