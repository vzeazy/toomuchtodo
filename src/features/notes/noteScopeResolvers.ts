import { AppView } from '../../types';

export type NotePanelScope =
  | { scopeType: 'project'; scopeRef: string }
  | { scopeType: 'day'; scopeRef: string }
  | { scopeType: 'area'; scopeRef: string };

export const resolveNotePanelScope = (input: {
  view: AppView;
  projectId: string | null;
  dateStr: string | null;
  selectedArea: string | null;
  todayDateStr: string;
}): NotePanelScope | null => {
  if (input.projectId) {
    return { scopeType: 'project', scopeRef: input.projectId };
  }

  if (input.view === 'day' || input.view === 'today') {
    const ref = input.view === 'today' ? input.todayDateStr : input.dateStr;
    if (!ref) return null;
    return { scopeType: 'day', scopeRef: ref };
  }

  if (input.selectedArea) {
    return { scopeType: 'area', scopeRef: input.selectedArea };
  }

  return null;
};
