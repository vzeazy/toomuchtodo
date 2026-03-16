import { DayGoal, Task } from '../../types';

export const sortDayGoals = (goals: DayGoal[]) => (
  [...goals].sort((left, right) => left.position - right.position || left.createdAt - right.createdAt)
);

export const getGoalsForDate = (goals: DayGoal[], date: string) => (
  sortDayGoals(goals.filter((goal) => goal.deletedAt === null && goal.date === date))
);

export const getActiveGoalsForDate = (goals: DayGoal[], date: string) => (
  getGoalsForDate(goals, date).filter((goal) => goal.archivedAt === null)
);

export const getLinkedTaskForGoal = (goal: DayGoal, tasks: Task[]) => (
  goal.linkedTaskId ? tasks.find((task) => task.id === goal.linkedTaskId) ?? null : null
);

export const hasOpenGoalSlots = (goals: DayGoal[], limit = 3) => goals.length < limit;
