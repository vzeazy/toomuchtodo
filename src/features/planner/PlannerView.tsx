import React from 'react';
import { AlignLeft, Shrink, FolderMinus, CalendarDays, Sun, CloudSun, Cloud, CloudFog, CloudRain, Snowflake, CloudLightning } from 'lucide-react';
import { GhostItem } from '../../components/GhostItem';
import { TaskCheckbox } from '../../components/TaskCheckbox';
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
  onToggleComplete: (id: string) => void;
  onAddTask: (title: string, dueDate: string) => void;
  onAddProjectTask: (title: string, projectId: string) => void;
  onOpenTask: (task: Task) => void;
  onOpenProject: (projectId: string) => void;
  onOpenDay: (dateStr: string) => void;
  onToggleHideEmptyProjects: () => void;
  onToggleCompactEmptyDays: () => void;
  onToggleStartOnToday: () => void;
}> = ({ weekDays, tasks, projects, widthMode, selectedArea, hideEmptyProjects, compactEmptyDays, startOnToday, onUpdateTask, onMoveTaskBefore, onMoveTaskAfter, onToggleComplete, onAddTask, onAddProjectTask, onOpenTask, onOpenProject, onOpenDay, onToggleHideEmptyProjects, onToggleCompactEmptyDays, onToggleStartOnToday }) => {
  const hasTaskDragPayload = (dataTransfer: DataTransfer) => Array.from(dataTransfer.types || []).includes('taskId');
  const weather = useWeather();
  const [dragOverDay, setDragOverDay] = React.useState<string | null>(null);
  const [dragOverProject, setDragOverProject] = React.useState<string | null>(null);
  const parentTasks = tasks.filter((task) => task.parentId === null);
  const firstVisibleDate = weekDays[0]?.dateStr;
  const carryForwardTasks = parentTasks.filter((task) => task.status !== 'completed' && task.dueDate && firstVisibleDate && task.dueDate < firstVisibleDate);
  const visibleProjects = hideEmptyProjects
    ? projects.filter((project) => parentTasks.some((task) => task.projectId === project.id && (!selectedArea || task.area === selectedArea)))
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
          const dayTasks = parentTasks.filter((task) => task.dueDate === day.dateStr);
          const isEmpty = dayTasks.length === 0;
          const weatherCode = weather[day.dateStr];

          return (
            <div
              key={day.dateStr}
              className={`relative flex flex-col px-3 py-2 transition-all ${compactEmptyDays && isEmpty ? 'min-h-[180px] opacity-55' : 'min-h-[360px]'} ${day.isToday ? 'bg-[rgba(255,255,255,0.02)] rounded-2xl' : ''} ${dragOverDay === day.dateStr ? 'rounded-2xl bg-[rgba(255,255,255,0.05)] ring-1 ring-[var(--accent)]/65' : ''}`}
              onDragEnter={() => setDragOverDay(day.dateStr)}
              onDragLeave={() => setDragOverDay((value) => value === day.dateStr ? null : value)}
              onDragOver={(event) => {
                if (!hasTaskDragPayload(event.dataTransfer)) return;
                event.preventDefault();
              }}
              onDrop={(event) => {
                setDragOverDay(null);
                if (dayTasks.length > 0) return;
                const id = event.dataTransfer.getData('taskId');
                if (id) onUpdateTask(id, { dueDate: day.dateStr, status: 'scheduled' });
              }}
            >
              {dragOverDay === day.dateStr && (
                <div className="pointer-events-none absolute right-3 top-3 rounded-full bg-[var(--accent-soft)] px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] text-[var(--accent)]">
                  {dayTasks.length > 0 ? 'Use insert lines' : `Schedule for ${day.dayName}`}
                </div>
              )}
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
                    label="Insert at top"
                    onDropTask={(id) => {
                      onMoveTaskBefore(id, dayTasks[0].id);
                      onUpdateTask(id, { dueDate: day.dateStr, status: 'scheduled' });
                    }}
                  />
                )}
                {dayTasks.map((task, index) => (
                  <React.Fragment key={task.id}>
                    <PlannerTaskRow
                      key={task.id}
                      task={task}
                      layout="day"
                      onUpdateTask={onUpdateTask}
                      onOpenTask={onOpenTask}
                      onToggleComplete={onToggleComplete}
                    />
                    <PlannerDropZone
                      label={index === dayTasks.length - 1 ? 'Insert at bottom' : 'Insert here'}
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
                  <PlannerTaskRow
                    key={task.id}
                    task={task}
                    layout="carry-forward"
                    onUpdateTask={onUpdateTask}
                    onOpenTask={onOpenTask}
                    onToggleComplete={onToggleComplete}
                  />
                ))}
              </div>
            </div>
          )}
          {visibleProjects.map((project) => (
            <div
              key={project.id}
              className={`relative rounded-2xl px-2 py-2 transition-all ${dragOverProject === project.id ? 'bg-[rgba(255,255,255,0.04)] ring-1 ring-[var(--accent)]/65' : ''}`}
              onDragEnter={() => setDragOverProject(project.id)}
              onDragLeave={() => setDragOverProject((value) => value === project.id ? null : value)}
              onDragOver={(event) => {
                if (!hasTaskDragPayload(event.dataTransfer)) return;
                event.preventDefault();
              }}
              onDrop={(event) => {
                setDragOverProject(null);
                const id = event.dataTransfer.getData('taskId');
                if (id) onUpdateTask(id, { projectId: project.id });
              }}
            >
              {dragOverProject === project.id && (
                <div className="pointer-events-none absolute right-3 top-2 rounded-full bg-[var(--accent-soft)] px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] text-[var(--accent)]">
                  Move to project
                </div>
              )}
              <button type="button" className={`mb-3 truncate text-left text-[16px] font-semibold tracking-[-0.02em] text-[var(--text-primary)] ${dragOverProject === project.id ? 'opacity-90' : ''}`} onClick={() => onOpenProject(project.id)}>
                {project.name}
              </button>
              <div className="space-y-1">
                {parentTasks.filter((task) => task.projectId === project.id && (!selectedArea || task.area === selectedArea)).slice(0, 8).map((task) => (
                  <PlannerTaskRow
                    key={task.id}
                    task={task}
                    layout="project"
                    onUpdateTask={onUpdateTask}
                    onOpenTask={onOpenTask}
                    onToggleComplete={onToggleComplete}
                  />
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
  label: string;
  onDropTask: (id: string) => void;
}> = ({ label, onDropTask }) => {
  const hasTaskDragPayload = (dataTransfer: DataTransfer) => Array.from(dataTransfer.types || []).includes('taskId');
  const [isDragOver, setIsDragOver] = React.useState(false);

  return (
    <div
      className="relative h-4"
      onDragEnter={() => setIsDragOver(true)}
      onDragLeave={() => setIsDragOver(false)}
      onDragOver={(event) => {
        if (!hasTaskDragPayload(event.dataTransfer)) return;
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
      <div className={`absolute inset-x-0 top-1/2 h-[2px] -translate-y-1/2 transition-colors ${isDragOver ? 'bg-[var(--accent)]/90' : 'bg-transparent'}`} />
      {isDragOver && (
        <div className="pointer-events-none absolute right-1 top-1/2 -translate-y-1/2 rounded-full bg-[var(--accent-soft)] px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] text-[var(--accent)]">
          {label}
        </div>
      )}
    </div>
  );
};

const PlannerTaskRow: React.FC<{
  task: Task;
  layout: 'day' | 'carry-forward' | 'project';
  onUpdateTask: (id: string, updates: Partial<Task>) => void;
  onOpenTask: (task: Task) => void;
  onToggleComplete: (id: string) => void;
}> = ({ task, layout, onUpdateTask, onOpenTask, onToggleComplete }) => {
  const [isEditingTitle, setIsEditingTitle] = React.useState(false);
  const [draftTitle, setDraftTitle] = React.useState(task.title);
  const clickTimeoutRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    setDraftTitle(task.title);
  }, [task.title]);

  React.useEffect(() => {
    return () => {
      if (clickTimeoutRef.current) window.clearTimeout(clickTimeoutRef.current);
    };
  }, []);

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

  const handleRowDoubleClick = (event: React.MouseEvent) => {
    event.stopPropagation();
    if (clickTimeoutRef.current) {
      window.clearTimeout(clickTimeoutRef.current);
      clickTimeoutRef.current = null;
    }
    onOpenTask(task);
  };

  const commitTitleEdit = () => {
    const nextTitle = draftTitle.trim();
    if (nextTitle && nextTitle !== task.title) onUpdateTask(task.id, { title: nextTitle });
    setDraftTitle(nextTitle || task.title);
    setIsEditingTitle(false);
  };

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onClick={handleRowClick}
      onDoubleClick={handleRowDoubleClick}
      className={`group flex w-full items-center gap-2 rounded-lg px-1.5 py-1 text-left transition-colors hover:bg-[rgba(255,255,255,0.03)] ${layout === 'day' ? 'min-h-[28px]' : 'min-h-[26px]'}`}
    >
      <span onClick={(event) => event.stopPropagation()} onDoubleClick={(event) => event.stopPropagation()}>
        <TaskCheckbox checked={task.status === 'completed'} onToggle={() => onToggleComplete(task.id)} className="h-[16px] w-[16px]" />
      </span>
      {isEditingTitle ? (
        <input
          autoFocus
          value={draftTitle}
          onChange={(event) => setDraftTitle(event.target.value)}
          onClick={(event) => event.stopPropagation()}
          onDoubleClick={(event) => event.stopPropagation()}
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
          className="w-full rounded bg-transparent text-[12.5px] text-[var(--text-primary)] outline-none ring-1 ring-[var(--focus)]"
        />
      ) : (
        <span className={`truncate text-[12.5px] ${task.status === 'completed' ? 'text-[var(--text-muted)] line-through' : 'text-[var(--text-secondary)]'}`}>
          {task.title}
        </span>
      )}
      {layout !== 'day' && <AlignLeft size={12} className="ml-auto shrink-0 text-[var(--text-muted)] opacity-0 transition-opacity group-hover:opacity-60" />}
    </div>
  );
};
