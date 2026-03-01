import React from 'react';
import { NotebookPen } from 'lucide-react';
import { GhostItem } from '../../components/GhostItem';
import { PlannerWidthMode, Project, Task } from '../../types';

export const PlannerView: React.FC<{
  weekDays: Array<{ dateStr: string; dayName: string; dayNum: number; month: string; year: number; isToday: boolean }>;
  tasks: Task[];
  projects: Project[];
  widthMode: PlannerWidthMode;
  selectedArea: string | null;
  hideEmptyProjects: boolean;
  compactEmptyDays: boolean;
  onUpdateTask: (id: string, updates: Partial<Task>) => void;
  onMoveTaskBefore: (sourceId: string, targetId: string) => void;
  onMoveTaskAfter: (sourceId: string, targetId: string) => void;
  onAddTask: (title: string, dueDate: string) => void;
  onAddProjectTask: (title: string, projectId: string) => void;
  onOpenTask: (task: Task) => void;
  onOpenProject: (projectId: string) => void;
  onOpenDay: (dateStr: string) => void;
  onToggleHideEmptyProjects: () => void;
  onToggleCompactEmptyDays: () => void;
}> = ({ weekDays, tasks, projects, widthMode, selectedArea, hideEmptyProjects, compactEmptyDays, onUpdateTask, onMoveTaskBefore, onMoveTaskAfter, onAddTask, onAddProjectTask, onOpenTask, onOpenProject, onOpenDay, onToggleHideEmptyProjects, onToggleCompactEmptyDays }) => {
  const firstVisibleDate = weekDays[0]?.dateStr;
  const carryForwardTasks = tasks.filter((task) => task.status !== 'completed' && task.dueDate && firstVisibleDate && task.dueDate < firstVisibleDate);
  const visibleProjects = hideEmptyProjects
    ? projects.filter((project) => tasks.some((task) => task.projectId === project.id && (!selectedArea || task.area === selectedArea)))
    : projects;

  return (
  <div className={`space-y-12 ${widthMode === 'container' ? 'mx-auto max-w-7xl' : widthMode === 'wide' ? 'mx-auto max-w-[92rem]' : 'w-full max-w-none'}`}>
    <div>
      <h1 className="text-[26px] font-medium leading-[1.05] tracking-[-0.03em] text-[var(--text-primary)]">Weekly Planner</h1>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onToggleCompactEmptyDays}
          className={`rounded-full border px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.12em] transition-all ${compactEmptyDays ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]' : 'border-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}
        >
          Compact Empty Days
        </button>
        <button
          type="button"
          onClick={onToggleHideEmptyProjects}
          className={`rounded-full border px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.12em] transition-all ${hideEmptyProjects ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]' : 'border-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}
        >
          Hide Empty Projects
        </button>
      </div>
    </div>

    {carryForwardTasks.length > 0 && (
      <div className="rounded-[26px] border soft-divider px-4 py-4">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--text-muted)]">Carry Forward</div>
            <div className="mt-1 text-[16px] font-medium tracking-[-0.02em] text-[var(--text-primary)]">Open items from earlier weeks</div>
          </div>
          <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--text-muted)]">{carryForwardTasks.length}</div>
        </div>
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {carryForwardTasks.map((task) => (
            <button
              key={task.id}
              type="button"
              onClick={() => onOpenTask(task)}
              className="flex items-center gap-2 rounded-2xl border soft-divider px-3 py-2 text-left transition-colors hover:bg-[rgba(255,255,255,0.03)]"
            >
              <span className="min-w-0 flex-1 truncate text-[13px] text-[var(--text-secondary)]">{task.title}</span>
              <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--text-muted)]">{task.dueDate}</span>
            </button>
          ))}
        </div>
      </div>
    )}

    <div className="grid gap-4 lg:grid-cols-7">
      {weekDays.map((day) => {
        const dayTasks = tasks.filter((task) => task.dueDate === day.dateStr);
        const isEmpty = dayTasks.length === 0;

        return (
        <div
          key={day.dateStr}
          className={`flex flex-col px-3 py-2 transition-all ${compactEmptyDays && isEmpty ? 'min-h-[180px] opacity-55' : 'min-h-[360px]'} ${day.isToday ? 'bg-[rgba(255,255,255,0.02)] rounded-2xl' : ''}`}
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            if (dayTasks.length > 0) return;
            const id = event.dataTransfer.getData('taskId');
            if (id) onUpdateTask(id, { dueDate: day.dateStr, status: 'scheduled' });
          }}
        >
          <div className="mb-3 pb-2">
            <div className={`mb-1 text-[10px] font-medium ${day.isToday ? 'text-[var(--accent)]' : 'text-[var(--text-muted)]'}`}>{day.dayNum} {day.month}</div>
            <button
              type="button"
              onClick={() => onOpenDay(day.dateStr)}
              className={`text-left text-[18px] font-medium tracking-[-0.03em] transition-opacity hover:opacity-75 ${day.isToday ? 'text-[var(--accent)]' : 'text-[var(--text-primary)]'}`}
            >
              {day.dayName}
            </button>
          </div>

          <div className="flex-1 space-y-1.5">
            {dayTasks.length > 0 && (
              <PlannerDropZone
                onDropTask={(id) => {
                  onMoveTaskBefore(id, dayTasks[0].id);
                  onUpdateTask(id, { dueDate: day.dateStr, status: 'scheduled' });
                }}
              />
            )}
            {dayTasks.map((task, index) => (
              <React.Fragment key={task.id}>
              <button
                key={task.id}
                type="button"
                draggable
                onDragStart={(event) => {
                  event.dataTransfer.setData('taskId', task.id);
                  event.dataTransfer.setData('context', 'reorder');
                }}
                onClick={() => onOpenTask(task)}
                className="group w-full rounded-xl px-2 py-1.5 text-left text-[13px] transition-colors hover:bg-[rgba(255,255,255,0.03)]"
              >
                <div className="flex items-center gap-2">
                  <span className={`flex-1 ${task.status === 'completed' ? 'text-[var(--text-muted)] line-through' : 'text-[var(--text-secondary)]'}`}>{task.title}</span>
                  {task.description.trim() && <NotebookPen size={12} className="shrink-0 text-[var(--text-muted)]" />}
                </div>
              </button>
              <PlannerDropZone
                onDropTask={(id) => {
                  if (index === dayTasks.length - 1) onMoveTaskAfter(id, task.id);
                  else onMoveTaskBefore(id, dayTasks[index + 1].id);
                  onUpdateTask(id, { dueDate: day.dateStr, status: 'scheduled' });
                }}
              />
              </React.Fragment>
            ))}
            <GhostItem placeholder="New action..." onAdd={(title) => onAddTask(title, day.dateStr)} className="mt-2 opacity-40 hover:opacity-100" />
          </div>
        </div>
      )})}
    </div>

    <div className="pt-8">
      <div className="grid gap-10 md:grid-cols-2 xl:grid-cols-4">
        {visibleProjects.map((project) => (
          <div
            key={project.id}
            className="px-2 py-2"
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              const id = event.dataTransfer.getData('taskId');
              if (id) onUpdateTask(id, { projectId: project.id });
            }}
          >
            <button type="button" className="mb-3 truncate text-left text-[16px] font-semibold tracking-[-0.02em] text-[var(--text-primary)]" onClick={() => onOpenProject(project.id)}>
              {project.name}
            </button>
            <div className="space-y-1">
              {tasks.filter((task) => task.projectId === project.id && (!selectedArea || task.area === selectedArea)).slice(0, 8).map((task) => (
                <button key={task.id} type="button" draggable onDragStart={(event) => { event.dataTransfer.setData('taskId', task.id); event.dataTransfer.setData('context', 'reorder'); }} className="block w-full truncate px-1 py-1.5 text-left text-[13px] text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]" onClick={() => onOpenTask(task)}>
                  {task.title}
                </button>
              ))}
              <GhostItem placeholder="Add to list..." onAdd={(title) => onAddProjectTask(title, project.id)} className="mt-1 opacity-40" />
            </div>
          </div>
        ))}
      </div>
    </div>
  </div>
  );
};

const PlannerDropZone: React.FC<{
  onDropTask: (id: string) => void;
}> = ({ onDropTask }) => (
  <div
    className="group relative h-2"
    onDragOver={(event) => event.preventDefault()}
    onDrop={(event) => {
      event.preventDefault();
      const id = event.dataTransfer.getData('taskId');
      if (id) onDropTask(id);
    }}
  >
    <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-transparent transition-colors group-hover:bg-[var(--accent)]" />
  </div>
);
