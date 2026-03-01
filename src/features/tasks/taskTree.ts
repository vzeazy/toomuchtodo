import { Task } from '../../types';

export interface TaskTreeRow {
  task: Task;
  depth: number;
  hasChildren: boolean;
  isContextAncestor: boolean;
}

const getTaskMap = (tasks: Task[]) => new Map(tasks.map((task) => [task.id, task]));

export const getTaskDescendantIds = (taskId: string, tasks: Task[]) => {
  const childrenByParent = new Map<string | null, Task[]>();

  for (const task of tasks) {
    const list = childrenByParent.get(task.parentId) || [];
    list.push(task);
    childrenByParent.set(task.parentId, list);
  }

  const descendants: string[] = [];
  const visit = (parentId: string) => {
    for (const child of childrenByParent.get(parentId) || []) {
      descendants.push(child.id);
      visit(child.id);
    }
  };

  visit(taskId);
  return descendants;
};

export const canReparentTask = (taskId: string, candidateParentId: string | null, tasks: Task[]) => {
  if (!candidateParentId) return true;
  if (taskId === candidateParentId) return false;
  return !getTaskDescendantIds(taskId, tasks).includes(candidateParentId);
};

export const collectTaskIdsWithAncestors = (taskIds: string[], tasks: Task[]) => {
  const taskMap = getTaskMap(tasks);
  const contextIds = new Set(taskIds);

  for (const taskId of taskIds) {
    let current = taskMap.get(taskId);
    while (current?.parentId) {
      const parent = taskMap.get(current.parentId);
      if (!parent) break;
      contextIds.add(parent.id);
      current = parent;
    }
  }

  return contextIds;
};

export const buildVisibleTaskTree = (tasks: Task[], matchedTaskIds?: Set<string>) => {
  const taskMap = getTaskMap(tasks);
  const childrenByParent = new Map<string | null, Task[]>();

  for (const task of tasks) {
    const parentId = task.parentId && taskMap.has(task.parentId) ? task.parentId : null;
    const list = childrenByParent.get(parentId) || [];
    list.push(task);
    childrenByParent.set(parentId, list);
  }

  const rows: TaskTreeRow[] = [];
  const visit = (parentId: string | null, depth: number) => {
    for (const task of childrenByParent.get(parentId) || []) {
      const hasChildren = (childrenByParent.get(task.id) || []).length > 0;
      rows.push({
        task,
        depth,
        hasChildren,
        isContextAncestor: matchedTaskIds ? !matchedTaskIds.has(task.id) : false,
      });
      if (!task.collapsed) visit(task.id, depth + 1);
    }
  };

  visit(null, 0);
  return rows;
};

const findSubtreeIdsInOrder = (taskId: string, tasks: Task[]) => {
  const subtreeIds = new Set([taskId, ...getTaskDescendantIds(taskId, tasks)]);
  return tasks.filter((task) => subtreeIds.has(task.id)).map((task) => task.id);
};

const getSubtreeTailId = (taskId: string, tasks: Task[]) => {
  const subtreeIds = new Set(findSubtreeIdsInOrder(taskId, tasks));
  let tailId = taskId;

  for (const task of tasks) {
    if (subtreeIds.has(task.id)) tailId = task.id;
  }

  return tailId;
};

export const moveTaskSubtree = (
  tasks: Task[],
  sourceId: string,
  targetId: string,
  position: 'before' | 'after',
  parentId: string | null,
) => {
  if (sourceId === targetId) return tasks;
  if (!canReparentTask(sourceId, parentId, tasks)) return tasks;

  const movingIds = new Set(findSubtreeIdsInOrder(sourceId, tasks));
  if (movingIds.has(targetId)) return tasks;

  const block = tasks
    .filter((task) => movingIds.has(task.id))
    .map((task) => task.id === sourceId ? { ...task, parentId } : task);
  const remaining = tasks.filter((task) => !movingIds.has(task.id));
  const anchorId = position === 'after' ? getSubtreeTailId(targetId, remaining) : targetId;
  const anchorIndex = remaining.findIndex((task) => task.id === anchorId);

  if (anchorIndex === -1) return tasks;

  const nextTasks = [...remaining];
  nextTasks.splice(position === 'before' ? anchorIndex : anchorIndex + 1, 0, ...block);
  return nextTasks;
};

export const moveTaskSubtreePreserveParent = (
  tasks: Task[],
  sourceId: string,
  targetId: string,
  position: 'before' | 'after',
) => {
  const sourceTask = tasks.find((task) => task.id === sourceId);
  if (!sourceTask) return tasks;
  return moveTaskSubtree(tasks, sourceId, targetId, position, sourceTask.parentId);
};

export const updateTaskParent = (tasks: Task[], taskId: string, parentId: string | null) => {
  if (!canReparentTask(taskId, parentId, tasks)) return tasks;
  return tasks.map((task) => task.id === taskId ? { ...task, parentId } : task);
};
