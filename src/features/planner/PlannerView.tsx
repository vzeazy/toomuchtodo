import React from 'react';
import { NotebookPen, Shrink, FolderMinus, CalendarDays, Sun, CloudSun, Cloud, CloudFog, CloudRain, Snowflake, CloudLightning } from 'lucide-react';
import { GhostItem } from '../../components/GhostItem';
import { PlannerWidthMode, Project, Task } from '../../types';
import { useWeather, WeatherCode } from '../../lib/useWeather';

const WeatherIcon: React.FC<{ code?: WeatherCode }> = ({ code }) => {
  if (!code) return null;
  const props = { size: 14, className: "text-[var(--text-muted)] opacity-70" };
  switch (code) {
    case 'clear': return <Sun {...props} />;
    case 'partly': return <CloudSun {...props} />;
    case 'cloudy': return <Cloud {...props} />;
    case 'fog': return <CloudFog {...props} />;
    case 'rain': return <CloudRain {...props} />;
    case 'snow': return <Snowflake {...props} />;
    case 'thunder': return <CloudLightning {...props} />;
    default: return null;
  }
};

export const PlannerView: React.FC<{
  weekDays: Array<{ dateStr: string; dayName: string; dayNum: number; month: string; year: number; isToday: boolean }>;
  tasks: Task[];
  projects: Project[];
  widthMode: PlannerWidthMode;
  selectedArea: string | null;
  hideEmptyProjects: boolean;
  compactEmptyDays: boolean;
  startOnToday: boolean;
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
  onToggleStartOnToday: () => void;
}> = ({ weekDays, tasks, projects, widthMode, selectedArea, hideEmptyProjects, compactEmptyDays, startOnToday, onUpdateTask, onMoveTaskBefore, onMoveTaskAfter, onAddTask, onAddProjectTask, onOpenTask, onOpenProject, onOpenDay, onToggleHideEmptyProjects, onToggleCompactEmptyDays, onToggleStartOnToday }) => {
  const weather = useWeather();
  const firstVisibleDate = weekDays[0]?.dateStr;
  const carryForwardTasks = tasks.filter((task) => task.status !== 'completed' && task.dueDate && firstVisibleDate && task.dueDate < firstVisibleDate);
  const visibleProjects = hideEmptyProjects
    ? projects.filter((project) => tasks.some((task) => task.projectId === project.id && (!selectedArea || task.area === selectedArea)))
    : projects;

  return (
    <div className={`space-y-12 ${widthMode === 'container' ? 'mx-auto max-w-7xl' : widthMode === 'wide' ? 'mx-auto max-w-[92rem]' : 'w-full max-w-none'}`}>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-[26px] font-medium leading-[1.05] tracking-[-0.03em] text-[var(--text-primary)]">Weekly Planner</h1>
        <div className="panel-muted flex items-center rounded-xl border soft-divider p-1">
          <button
            type="button"
            onClick={onToggleCompactEmptyDays}
            className={`flex h-[28px] items-center gap-1.5 rounded-md px-3 text-[11.5px] font-medium transition-all ${compactEmptyDays ? 'bg-[var(--accent-soft)] text-[var(--accent)] shadow-[0_0_0_1px_var(--accent-soft)]' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}
          >
            <Shrink size={13} />
            <span>Compact Days</span>
          </button>
          <div className="mx-1 h-3.5 w-px bg-[var(--border-color)]" />
          <button
            type="button"
            onClick={onToggleStartOnToday}
            className={`flex h-[28px] items-center gap-1.5 rounded-md px-3 text-[11.5px] font-medium transition-all ${startOnToday ? 'bg-[var(--accent-soft)] text-[var(--accent)] shadow-[0_0_0_1px_var(--accent-soft)]' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}
          >
            <CalendarDays size={13} />
            <span>Today First</span>
          </button>
          <div className="mx-1 h-3.5 w-px bg-[var(--border-color)]" />
          <button
            type="button"
            onClick={onToggleHideEmptyProjects}
            className={`flex h-[28px] items-center gap-1.5 rounded-md px-3 text-[11.5px] font-medium transition-all ${hideEmptyProjects ? 'bg-[var(--accent-soft)] text-[var(--accent)] shadow-[0_0_0_1px_var(--accent-soft)]' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}
          >
            <FolderMinus size={13} />
            <span>Hide Empty Projects</span>
          </button>
        </div>
      </div>

      <div className={`grid gap-4 ${weekDays.length === 5 ? 'lg:grid-cols-5' : 'lg:grid-cols-7'}`}>
        {weekDays.map((day) => {
          const dayTasks = tasks.filter((task) => task.dueDate === day.dateStr);
          const isEmpty = dayTasks.length === 0;
          const weatherCode = weather[day.dateStr];

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
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onOpenDay(day.dateStr)}
                    className={`text-left text-[18px] font-medium tracking-[-0.03em] transition-opacity hover:opacity-75 ${day.isToday ? 'text-[var(--accent)]' : 'text-[var(--text-primary)]'}`}
                  >
                    {day.dayName}
                  </button>
                  {weatherCode && <WeatherIcon code={weatherCode} />}
                </div>
              </div>

              <div className="flex-1 space-y-0.5">
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
                      className="group w-full rounded-lg px-1.5 py-1 text-left text-[12.5px] transition-colors hover:bg-[rgba(255,255,255,0.03)]"
                    >
                      <div className="flex items-center gap-1.5">
                        <span className={`block flex-1 truncate ${task.status === 'completed' ? 'text-[var(--text-muted)] line-through' : 'text-[var(--text-secondary)]'}`}>{task.title}</span>
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
          )
        })}
      </div>

      <div className="pt-8">
        <div className="grid gap-10 md:grid-cols-2 xl:grid-cols-4">
          {carryForwardTasks.length > 0 && (
            <div className="px-2 py-2">
              <div className="mb-3 flex items-center justify-between pr-2">
                <span className="truncate text-[16px] font-semibold tracking-[-0.02em] text-[var(--text-primary)]">
                  Carry Forward
                </span>
                <span className="rounded bg-[var(--accent-soft)] px-1.5 py-0.5 text-[10px] font-bold uppercase text-[var(--accent)]">{carryForwardTasks.length}</span>
              </div>
              <div className="space-y-1">
                {carryForwardTasks.slice(0, 8).map((task) => (
                  <button key={task.id} type="button" draggable onDragStart={(event) => { event.dataTransfer.setData('taskId', task.id); event.dataTransfer.setData('context', 'reorder'); }} className="flex w-full items-center justify-between px-1 py-1.5 text-left transition-colors hover:text-[var(--text-primary)]" onClick={() => onOpenTask(task)}>
                    <span className="block flex-1 truncate mr-2 text-[13px] text-[var(--text-secondary)]">{task.title}</span>
                    <span className="shrink-0 text-[9px] font-medium uppercase tracking-[0.08em] text-[var(--text-muted)]">{task.dueDate?.split('-').slice(1).join('/')}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
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
}> = ({ onDropTask }) => {
  const [isDragOver, setIsDragOver] = React.useState(false);

  return (
    <div
      className="relative h-2"
      onDragEnter={() => setIsDragOver(true)}
      onDragLeave={() => setIsDragOver(false)}
      onDragOver={(event) => {
        event.preventDefault();
        setIsDragOver(true);
      }}
      onDrop={(event) => {
        event.preventDefault();
        setIsDragOver(false);
        const id = event.dataTransfer.getData('taskId');
        if (id) onDropTask(id);
      }}
    >
      <div className={`absolute inset-x-0 top-1/2 h-px -translate-y-1/2 transition-colors ${isDragOver ? 'bg-[var(--accent)]' : 'bg-transparent'}`} />
    </div>
  );
};
