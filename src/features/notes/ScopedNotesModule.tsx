import React from 'react';
import { AppView, Note } from '../../types';
import { getNoteTitleFromBody, matchesScope, sortNotes } from './noteUtils';
import { NotesModule } from './NotesModule';
import { resolveNotePanelScope } from './noteScopeResolvers';
import { isContextualNotesEnabledForSurfaceValue } from './notesModuleRegistry';

export const ScopedNotesModule: React.FC<{
  enabled: boolean;
  panel: { view: AppView; projectId: string | null; dateStr: string | null };
  selectedArea: string | null;
  notes: Note[];
  todayDateStr: string;
  onAddNote: (input: { scopeType: Note['scopeType']; scopeRef: string | null; title?: string; body?: string; pinned?: boolean }) => Note;
  onUpdateNote: (id: string, updates: Partial<Note>) => void;
  onDeleteNote: (id: string) => void;
  onTogglePinned: (id: string) => void;
  notesOrderByScope: Record<string, string[]>;
  onSetNotesOrder: (scopeKey: string, noteIds: string[]) => void;
  onOpenNotesDashboard: (scopeType: Note['scopeType'], scopeRef: string, noteId?: string | null) => void;
}> = ({
  enabled,
  panel,
  selectedArea,
  notes,
  todayDateStr,
  onAddNote,
  onUpdateNote,
  onDeleteNote,
  onTogglePinned,
  notesOrderByScope,
  onSetNotesOrder,
  onOpenNotesDashboard,
}) => {
  const scope = React.useMemo(() => resolveNotePanelScope({
    view: panel.view,
    projectId: panel.projectId,
    dateStr: panel.dateStr,
    selectedArea,
    todayDateStr,
  }), [panel.view, panel.projectId, panel.dateStr, selectedArea, todayDateStr]);
  const [activeNoteId, setActiveNoteId] = React.useState<string | null>(null);

  const scopedNotes = React.useMemo(() => {
    if (!scope) return [];
    return notes.filter((note) => note.deletedAt === null && matchesScope(note, scope.scopeType, scope.scopeRef));
  }, [notes, scope]);

  React.useEffect(() => {
    if (!scopedNotes.length) {
      setActiveNoteId(null);
      return;
    }
    if (activeNoteId && scopedNotes.some((note) => note.id === activeNoteId)) return;
    setActiveNoteId(scopedNotes[0].id);
  }, [activeNoteId, scopedNotes]);

  if (!scope || !isContextualNotesEnabledForSurfaceValue(enabled, 'task-panel')) {
    return null;
  }

  const scopeKey = `${scope.scopeType}:${scope.scopeRef}`;
  const scopedOrderIds = notesOrderByScope[scopeKey] ?? [];
  const orderedScopedNotes = React.useMemo(() => {
    const sortedScopedNotes = sortNotes(scopedNotes);
    if (!scopedOrderIds.length) return sortedScopedNotes;

    const byId = new Map(sortedScopedNotes.map((note) => [note.id, note]));
    const ordered: Note[] = [];
    for (const noteId of scopedOrderIds) {
      const note = byId.get(noteId);
      if (!note) continue;
      ordered.push(note);
      byId.delete(noteId);
    }
    for (const note of sortedScopedNotes) {
      if (byId.has(note.id)) ordered.push(note);
    }
    return ordered;
  }, [scopedNotes, scopedOrderIds]);

  const handleAddNote = (body: string) => {
    const note = onAddNote({
      scopeType: scope.scopeType,
      scopeRef: scope.scopeRef,
      title: getNoteTitleFromBody(body),
      body,
    });
    const nextOrder = [...orderedScopedNotes.map((item) => item.id).filter((id) => id !== note.id), note.id];
    onSetNotesOrder(scopeKey, nextOrder);
    setActiveNoteId(note.id);
    return note;
  };

  return (
    <NotesModule
      notes={orderedScopedNotes}
      activeNoteId={activeNoteId}
      onSetActiveNoteId={setActiveNoteId}
      onAddNote={handleAddNote}
      onUpdateNote={onUpdateNote}
      onDeleteNote={onDeleteNote}
      onTogglePinned={onTogglePinned}
      onReorderNotes={(noteIds) => onSetNotesOrder(scopeKey, noteIds)}
      onOpenInDashboard={(noteId) => onOpenNotesDashboard(scope.scopeType, scope.scopeRef, noteId ?? activeNoteId)}
    />
  );
};
