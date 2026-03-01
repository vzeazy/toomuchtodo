import React, { useMemo } from 'react';
import { Star, Trash2, X } from 'lucide-react';
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
}> = ({ task, tasks, projects, onClose, onUpdate, onSetParent, onDelete, onToggleStar, onToggleComplete }) => {
  const tagValue = useMemo(() => task.tags.join(', '), [task.tags]);
  const availableParents = useMemo(
    () => tasks.filter((candidate) => candidate.id !== task.id && canReparentTask(task.id, candidate.id, tasks)),
    [task.id, tasks],
  );

  return (
    <div className="fixed inset-0 z-[2100] flex items-center justify-center bg-[var(--overlay)] p-4 backdrop-blur-md" onClick={onClose}>
      <div className="panel-surface flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-[30px]" onClick={(event) => event.stopPropagation()}>
        <div className="panel-muted flex items-center justify-between border-b soft-divider px-6 py-4">
          <div className="flex items-center gap-3">
            <TaskCheckbox checked={task.status === 'completed'} onToggle={() => onToggleComplete(task.id)} />
            <button type="button" onClick={() => onToggleStar(task.id)} className={`transition-colors ${task.isStarred ? 'text-yellow-400' : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'}`}>
              <Star size={20} fill={task.isStarred ? 'currentColor' : 'none'} />
            </button>
            <span className="section-kicker text-[11px] font-bold uppercase text-[var(--accent)]">Task Details</span>
          </div>
          <button type="button" onClick={onClose} className="text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)]">
            <X size={20} />
          </button>
        </div>

        <div className="space-y-6 overflow-y-auto p-6">
          <input
            type="text"
            value={task.title}
            onChange={(event) => onUpdate(task.id, { title: event.target.value })}
            className="w-full border-none bg-transparent text-[34px] font-semibold leading-[1.05] tracking-[-0.04em] text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)]"
            placeholder="Task title"
          />

          <MarkdownEditor value={task.description} onChange={(value) => onUpdate(task.id, { description: value })} />

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--text-muted)]">Project</label>
              <select
                value={task.projectId || ''}
                onChange={(event) => onUpdate(task.id, { projectId: event.target.value || null })}
                className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--panel-alt-bg)] p-3 text-[13px] text-[var(--text-primary)] outline-none focus:border-[var(--focus)]"
              >
                <option value="">No Project</option>
                {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--text-muted)]">Area</label>
              <select
                value={task.area}
                onChange={(event) => onUpdate(task.id, { area: event.target.value })}
                className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--panel-alt-bg)] p-3 text-[13px] text-[var(--text-primary)] outline-none focus:border-[var(--focus)]"
              >
                {AREAS.map((area) => <option key={area} value={area}>{area}</option>)}
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--text-muted)]">Parent Task</label>
            <select
              value={task.parentId || ''}
              onChange={(event) => onSetParent(task.id, event.target.value || null)}
              className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--panel-alt-bg)] p-3 text-[13px] text-[var(--text-primary)] outline-none focus:border-[var(--focus)]"
            >
              <option value="">Top level</option>
              {availableParents.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.title}</option>)}
            </select>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--text-muted)]">Due Date</label>
              <input
                type="date"
                value={task.dueDate || ''}
                onChange={(event) => onUpdate(task.id, { dueDate: event.target.value || null, status: event.target.value ? 'scheduled' : task.status })}
                className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--panel-alt-bg)] p-3 text-[13px] text-[var(--text-primary)] outline-none focus:border-[var(--focus)]"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--text-muted)]">Tags</label>
              <input
                type="text"
                value={tagValue}
                onChange={(event) => onUpdate(task.id, { tags: event.target.value.split(',').map((tag) => tag.trim()).filter(Boolean) })}
                placeholder="comma, separated, tags"
                className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--panel-alt-bg)] p-3 text-[13px] text-[var(--text-primary)] outline-none focus:border-[var(--focus)]"
              />
            </div>
          </div>

          {task.tags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {task.tags.map((tag) => <span key={tag} className="rounded-full bg-[var(--accent-soft)] px-2 py-1 text-[11px] font-medium text-[var(--accent)]">#{tag}</span>)}
            </div>
          )}
        </div>

        <div className="panel-muted flex items-center justify-between border-t soft-divider px-6 py-4">
          <button type="button" onClick={() => { onDelete(task.id); onClose(); }} className="flex items-center gap-2 text-xs font-medium text-[var(--danger)] transition-colors hover:opacity-85">
            <Trash2 size={14} /> Delete
          </button>
          <button type="button" onClick={onClose} className="rounded-lg bg-[var(--accent)] px-6 py-2 text-sm font-semibold text-[var(--accent-contrast)] transition-opacity hover:opacity-90">
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
