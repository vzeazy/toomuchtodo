import { Note, NoteScopeType, Project } from '../../types';

export type NoteScopeFilter = 'all' | NoteScopeType;

export const getDefaultNoteTitle = (scopeType: NoteScopeType, scopeRef: string | null) => {
  switch (scopeType) {
    case 'project':
      return 'Untitled project note';
    case 'area':
      return scopeRef ? `${scopeRef} note` : 'Untitled area note';
    case 'day':
      return scopeRef ? `Notes for ${scopeRef}` : 'Untitled day note';
    case 'dashboard':
    default:
      return 'Untitled note';
  }
};

export const getScopeLabel = (
  scopeType: NoteScopeType,
  scopeRef: string | null,
  projects: Project[] = [],
) => {
  switch (scopeType) {
    case 'project':
      return `Project · ${projects.find((project) => project.id === scopeRef)?.name || 'Unknown project'}`;
    case 'area':
      return `Area · ${scopeRef || 'Unknown area'}`;
    case 'day':
      return `Day · ${scopeRef || 'Unknown day'}`;
    case 'dashboard':
    default:
      return 'Dashboard';
  }
};

export const formatNoteTimestamp = (timestamp: number) => new Date(timestamp).toLocaleString('en-US', {
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});

export const sortNotes = (notes: Note[]) => [...notes].sort((left, right) => (
  Number(right.pinned) - Number(left.pinned)
  || right.updatedAt - left.updatedAt
  || right.createdAt - left.createdAt
));

export const getActiveNotes = (notes: Note[]) => notes.filter((note) => note.deletedAt === null);

export const matchesScope = (note: Note, scopeType: NoteScopeType, scopeRef: string | null) => (
  note.scopeType === scopeType && note.scopeRef === scopeRef
);
