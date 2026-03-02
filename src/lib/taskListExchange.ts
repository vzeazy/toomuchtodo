import { Project, Task, TaskListExchange, TaskListScope } from '../types';

const isTaskInScope = (task: Task, scope: TaskListScope) => {
  if (scope.type === 'inbox') return task.status === 'inbox';
  return task.projectId === scope.projectId;
};

export const createTaskListExchangePayload = (
  tasks: Task[],
  projects: Project[],
  scope: TaskListScope,
): TaskListExchange => {
  const scopedTasks = tasks.filter((task) => isTaskInScope(task, scope));
  const scopedTaskIds = new Set(scopedTasks.map((task) => task.id));
  const scopedProjects = scope.type === 'project'
    ? projects.filter((project) => project.id === scope.projectId)
    : projects.filter((project) => scopedTasks.some((task) => task.projectId === project.id));

  return {
    schema: 'too-much-to-do.task-list',
    version: 1,
    exportedAt: new Date().toISOString(),
    scope,
    projects: scopedProjects.map((project) => ({
      id: project.id,
      name: project.name,
      parentId: project.parentId ?? null,
      color: project.color,
    })),
    tasks: scopedTasks.map((task) => ({
      id: task.id,
      title: task.title,
      description: task.description,
      status: task.status,
      isStarred: task.isStarred,
      projectId: task.projectId,
      area: task.area,
      dueDate: task.dueDate,
      parentId: task.parentId && scopedTaskIds.has(task.parentId) ? task.parentId : null,
      collapsed: task.collapsed,
      createdAt: task.createdAt,
      tags: task.tags,
    })),
  };
};

export const isTaskListExchange = (value: unknown): value is TaskListExchange => {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<TaskListExchange>;
  if (candidate.schema !== 'too-much-to-do.task-list') return false;
  if (typeof candidate.version !== 'number') return false;
  if (!candidate.scope || typeof candidate.scope !== 'object') return false;
  if (!Array.isArray(candidate.tasks) || !Array.isArray(candidate.projects)) return false;
  return true;
};

export const getTaskListDisplayName = (scope: TaskListScope, projects: Project[]) => {
  if (scope.type === 'inbox') return 'Inbox';
  return projects.find((project) => project.id === scope.projectId)?.name || 'Project';
};

export const createTaskListProgressPrompt = (
  tasks: Task[],
  projects: Project[],
  scope: TaskListScope,
) => {
  const scopedTasks = tasks.filter((task) => isTaskInScope(task, scope));
  const completed = scopedTasks.filter((task) => task.status === 'completed').length;
  const today = new Date().toISOString().slice(0, 10);
  const overdue = scopedTasks.filter((task) => task.status !== 'completed' && !!task.dueDate && task.dueDate < today).length;
  const listName = getTaskListDisplayName(scope, projects);

  const lines = scopedTasks.map((task) => {
    const parts = [
      `id=${task.id}`,
      `title=${JSON.stringify(task.title)}`,
      `status=${task.status}`,
      `due=${task.dueDate || 'none'}`,
    ];
    if (task.tags.length) parts.push(`tags=${task.tags.join('|')}`);
    if (task.parentId) parts.push(`parentId=${task.parentId}`);
    return `- ${parts.join(' ')}`;
  });

  return `You are helping me replan a task list in Too Much To Do.
List: ${listName}
Scope: ${scope.type}${scope.type === 'project' ? ` (${scope.projectId})` : ''}
Total tasks: ${scopedTasks.length}
Completed: ${completed}
Open: ${scopedTasks.length - completed}
Overdue: ${overdue}

Current tasks:
${lines.join('\n') || '- (no tasks)'}

Return a JSON object using schema "too-much-to-do.task-list" with updated tasks for this same scope.
Keep ids stable when possible.`;
};

export const getTaskListGenerationPrompt = (targetProjectName: string, direction: string) => `You are generating a structured task list for the "Too Much To Do" app.

Goal:
- Build a practical project task list that can be imported into the app.
- Use complexity-aware structure: only include advanced fields when useful.

Output requirements:
- Return ONLY valid JSON.
- Use this exact schema envelope:
{
  "schema": "too-much-to-do.task-list",
  "version": 1,
  "exportedAt": "<ISO datetime>",
  "scope": { "type": "project", "projectId": "<target-project-id>" },
  "projects": [{ "id": "<project-id>", "name": "<project-name>", "parentId": null, "color": "#hex optional" }],
  "tasks": [
    {
      "id": "<stable-task-id>",
      "title": "Task title",
      "description": "Markdown notes when useful",
      "status": "next",
      "isStarred": false,
      "projectId": "<project-id>",
      "area": "Personal",
      "dueDate": null,
      "parentId": null,
      "collapsed": false,
      "createdAt": <unix ms>,
      "tags": []
    }
  ]
}

Status rules:
- allowed status values: inbox, next, waiting, scheduled, someday, completed, deleted
- default to "next" unless a better status is obvious

Modeling guidance:
- Use parentId to create subtasks only when hierarchy is helpful
- Add dueDate only for date-sensitive work
- Add tags only when they help organization
- Use descriptions for nuanced execution notes/checklists
- Keep ids deterministic and human-readable (slug-style)

Target project:
- name: ${targetProjectName || 'Imported Project'}

User direction:
${direction.trim() || '(none provided)'}

Return JSON now.`;

const formatTaskLine = (task: Task) => {
  const checkbox = task.status === 'completed' ? '[x]' : '[ ]';
  const attrs: string[] = [];
  if (task.status !== 'inbox' && task.status !== 'completed') attrs.push(`status:${task.status}`);
  if (task.dueDate) attrs.push(`due:${task.dueDate}`);
  if (task.tags.length) attrs.push(task.tags.map((tag) => `#${tag}`).join(' '));
  return `${checkbox} ${task.title}${attrs.length ? ` (${attrs.join(' | ')})` : ''}`;
};

export const createTaskListMarkdown = (
  tasks: Task[],
  projects: Project[],
  scope: TaskListScope,
) => {
  const scopedTasks = tasks.filter((task) => isTaskInScope(task, scope));
  const scopedIds = new Set(scopedTasks.map((task) => task.id));
  const topLevel = scopedTasks.filter((task) => !task.parentId || !scopedIds.has(task.parentId));
  const childrenByParent = new Map<string, Task[]>();

  for (const task of scopedTasks) {
    if (!task.parentId || !scopedIds.has(task.parentId)) continue;
    const list = childrenByParent.get(task.parentId) || [];
    list.push(task);
    childrenByParent.set(task.parentId, list);
  }

  const lines: string[] = [];
  const walk = (task: Task, depth: number) => {
    lines.push(`${'  '.repeat(depth)}- ${formatTaskLine(task)}`);
    for (const child of childrenByParent.get(task.id) || []) walk(child, depth + 1);
  };

  for (const task of topLevel) walk(task, 0);

  const title = getTaskListDisplayName(scope, projects);
  return `# ${title} Task List

Exported: ${new Date().toISOString()}
Scope: ${scope.type}${scope.type === 'project' ? ` (${scope.projectId})` : ''}

${lines.join('\n') || '- (no tasks)'}
`;
};
