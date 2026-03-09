import React from 'react';
import { Search } from 'lucide-react';
import { Project, Task } from '../../types';

export const SearchView: React.FC<{
  query: string;
  tasks: Task[];
  projects: Project[];
  onOpenTask: (task: Task) => void;
}> = ({ query, tasks, projects, onOpenTask }) => (
  <div className="mx-auto max-w-5xl">
    <div className="mb-10">
      <div className="section-kicker mb-2 text-[10px] font-bold uppercase text-[var(--accent)]">Search</div>
      <h1 className="text-[34px] font-semibold leading-[1.02] tracking-[-0.04em] text-[var(--text-primary)]">Search</h1>
        <div className="mt-2 text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--text-muted)]">
          {query ? `${tasks.length} task results for "${query}"` : 'Focus the sidebar search to query tasks, tags, and projects'}
        </div>
    </div>

    <div className="panel-surface rounded-[28px]">
      {tasks.length === 0 ? (
        <div className="flex items-center gap-3 px-6 py-8 text-[var(--text-secondary)]">
          <Search size={18} className="text-[var(--text-muted)]" />
          <span>{query ? 'No matching tasks found.' : 'Start typing to search.'}</span>
        </div>
      ) : (
        tasks.map((task) => (
          <button key={task.id} type="button" onClick={() => onOpenTask(task)} className="block w-full border-b soft-divider px-6 py-4 text-left transition-colors last:border-b-0 hover:bg-[rgba(255,255,255,0.03)]">
            <div className="flex items-center gap-2 text-[var(--text-primary)]">
              <span className="text-sm font-medium">{task.title}</span>
              {task.tags.map((tag) => <span key={tag} className="rounded-full bg-[var(--accent-soft)] px-2 py-0.5 text-[10px] uppercase tracking-wide text-[var(--accent)]">#{tag}</span>)}
            </div>
            <div className="mt-1 text-xs text-[var(--text-secondary)]">
              {projects.find((project) => project.id === task.projectId)?.name || 'No project'} · {task.area} · {task.status}
            </div>
            {task.description.trim() && <div className="mt-2 text-sm text-[var(--text-secondary)]">{task.description.replace(/\n+/g, ' ').slice(0, 180)}</div>}
          </button>
        ))
      )}
    </div>
  </div>
);
