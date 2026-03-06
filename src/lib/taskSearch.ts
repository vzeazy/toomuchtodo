import { Project, Task } from '../types';

interface SearchTasksOptions {
  includeCompleted: boolean;
}

const defaultOptions: SearchTasksOptions = {
  includeCompleted: true,
};

export const searchTasks = (
  tasks: Task[],
  projects: Project[],
  query: string,
  options: Partial<SearchTasksOptions> = {}
) => {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return [];

  const settings = { ...defaultOptions, ...options };
  const candidates = settings.includeCompleted ? tasks : tasks.filter((task) => task.status !== 'completed');

  return candidates.filter((task) => {
    const projectName = projects.find((project) => project.id === task.projectId)?.name || '';
    const haystack = [
      task.title,
      task.description,
      task.area,
      task.status,
      projectName,
      task.tags.join(' '),
    ].join(' ').toLowerCase();
    return haystack.includes(normalized);
  });
};
