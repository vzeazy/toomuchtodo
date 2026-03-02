import { Project, Task } from '../types';

export const getProjectChildrenMap = (projects: Project[]) => {
  const childrenByParent = new Map<string | null, Project[]>();

  for (const project of projects) {
    const parentId = project.parentId || null;
    const list = childrenByParent.get(parentId) || [];
    list.push(project);
    childrenByParent.set(parentId, list);
  }

  return childrenByParent;
};

export const getProjectSubtreeIds = (projectId: string, projects: Project[]) => {
  const childrenByParent = getProjectChildrenMap(projects);
  const ids = new Set<string>([projectId]);
  const stack = [projectId];

  while (stack.length > 0) {
    const currentId = stack.pop()!;
    for (const child of childrenByParent.get(currentId) || []) {
      if (ids.has(child.id)) continue;
      ids.add(child.id);
      stack.push(child.id);
    }
  }

  return ids;
};

export const flattenProjectTree = (projects: Project[]) => {
  const childrenByParent = getProjectChildrenMap(projects);
  const ordered: Array<{ project: Project; depth: number }> = [];

  const visit = (parentId: string | null, depth: number) => {
    for (const project of childrenByParent.get(parentId) || []) {
      ordered.push({ project, depth });
      visit(project.id, depth + 1);
    }
  };

  visit(null, 0);
  return ordered;
};

export const getParentTaskCountsByProject = (
  projects: Project[],
  tasks: Task[],
  selectedArea: string | null = null,
) => {
  const parentTasks = tasks.filter((task) => task.parentId === null && (!selectedArea || task.area === selectedArea));
  const subtreeIdsByProject = new Map<string, Set<string>>();

  for (const project of projects) {
    subtreeIdsByProject.set(project.id, getProjectSubtreeIds(project.id, projects));
  }

  const counts = new Map<string, number>();
  for (const project of projects) {
    const subtreeIds = subtreeIdsByProject.get(project.id) || new Set<string>([project.id]);
    counts.set(project.id, parentTasks.filter((task) => task.projectId && subtreeIds.has(task.projectId)).length);
  }

  return counts;
};
