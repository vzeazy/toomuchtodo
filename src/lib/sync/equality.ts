import { AppSettings, DayGoal, Note, Project, Task } from '../../types';

const areStringArraysEqual = (left: string[], right: string[]) => {
  if (left.length !== right.length) return false;
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) return false;
  }
  return true;
};

const areNotesOrderMapsEqual = (left: Record<string, string[]>, right: Record<string, string[]>) => {
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  if (leftKeys.length !== rightKeys.length) return false;
  for (const key of leftKeys) {
    if (!Object.prototype.hasOwnProperty.call(right, key)) return false;
    if (!areStringArraysEqual(left[key] || [], right[key] || [])) return false;
  }
  return true;
};

export const areTasksEqual = (left: Task, right: Task) => (
  left.id === right.id
  && left.title === right.title
  && left.description === right.description
  && left.status === right.status
  && left.isStarred === right.isStarred
  && left.projectId === right.projectId
  && left.area === right.area
  && left.dueDate === right.dueDate
  && left.dayPart === right.dayPart
  && left.parentId === right.parentId
  && left.collapsed === right.collapsed
  && left.createdAt === right.createdAt
  && areStringArraysEqual(left.tags, right.tags)
  && left.updatedAt === right.updatedAt
  && left.deletedAt === right.deletedAt
);

export const areProjectsEqual = (left: Project, right: Project) => (
  left.id === right.id
  && left.name === right.name
  && left.color === right.color
  && left.parentId === right.parentId
  && left.updatedAt === right.updatedAt
  && left.deletedAt === right.deletedAt
);

export const areNotesEqual = (left: Note, right: Note) => (
  left.id === right.id
  && left.title === right.title
  && left.body === right.body
  && left.scopeType === right.scopeType
  && left.scopeRef === right.scopeRef
  && left.pinned === right.pinned
  && left.createdAt === right.createdAt
  && left.updatedAt === right.updatedAt
  && left.deletedAt === right.deletedAt
);

export const areDayGoalsEqual = (left: DayGoal, right: DayGoal) => (
  left.id === right.id
  && left.date === right.date
  && left.title === right.title
  && left.linkedTaskId === right.linkedTaskId
  && left.position === right.position
  && left.completedAt === right.completedAt
  && left.archivedAt === right.archivedAt
  && left.createdAt === right.createdAt
  && left.updatedAt === right.updatedAt
  && left.deletedAt === right.deletedAt
);

export const areSettingsEqual = (left: AppSettings, right: AppSettings) => (
  left.activeThemeId === right.activeThemeId
  && left.plannerWidthMode === right.plannerWidthMode
  && left.taskListMode === right.taskListMode
  && left.notesListPreview === right.notesListPreview
  && left.notesViewLayout === right.notesViewLayout
  && Boolean(left.contextualNotesEnabled) === Boolean(right.contextualNotesEnabled)
  && areNotesOrderMapsEqual(left.contextualNotesOrder ?? {}, right.contextualNotesOrder ?? {})
  && left.showCompletedTasks === right.showCompletedTasks
  && left.hideEmptyProjectsInPlanner === right.hideEmptyProjectsInPlanner
  && left.compactEmptyDaysInPlanner === right.compactEmptyDaysInPlanner
  && left.startPlannerOnToday === right.startPlannerOnToday
  && left.groupDayViewByPart === right.groupDayViewByPart
  && left.dailyGoalsEnabled === right.dailyGoalsEnabled
);
