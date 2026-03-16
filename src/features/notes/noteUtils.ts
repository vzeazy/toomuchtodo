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

const normalizeTitleLine = (line: string) => line
  .replace(/^#{1,6}\s+/, '')
  .replace(/^\s*(?:[-*+]|\d+\.)\s+/, '')
  .replace(/^>\s?/, '')
  .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1')
  .replace(/`([^`]+)`/g, '$1')
  .replace(/\*\*([^*]+)\*\*/g, '$1')
  .replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, '$1$2')
  .trim();

export const getNoteTitleFromBody = (body: string, fallback = 'Untitled') => {
  const firstLine = body
    .split('\n')
    .map((line) => normalizeTitleLine(line))
    .find((line) => line.length > 0);

  if (!firstLine) return fallback;
  if (firstLine.length <= 72) return firstLine;
  return `${firstLine.slice(0, 71).trimEnd()}...`;
};

export const sortNotes = (notes: Note[]) => [...notes].sort((left, right) => (
  Number(right.pinned) - Number(left.pinned)
  || right.updatedAt - left.updatedAt
  || right.createdAt - left.createdAt
));

export const getActiveNotes = (notes: Note[]) => notes.filter((note) => note.deletedAt === null);

export const matchesScope = (note: Note, scopeType: NoteScopeType, scopeRef: string | null) => (
  note.scopeType === scopeType && note.scopeRef === scopeRef
);
