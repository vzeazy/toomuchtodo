import React from 'react';
import { ArrowRight, Plus, Star } from 'lucide-react';
import { getMarkdownExcerpt } from '../../lib/markdown';
import { Note, NoteScopeType } from '../../types';
import { NoteEditorCard } from './NoteEditorCard';
import { formatNoteTimestamp, sortNotes } from './noteUtils';

export const ScopedNotesSection: React.FC<{
  title: string;
  scopeType: NoteScopeType;
  scopeRef: string | null;
  notes: Note[];
  onAddNote: (input: { scopeType: NoteScopeType; scopeRef: string | null }) => Note;
  onUpdateNote: (id: string, updates: Partial<Note>) => void;
  onDeleteNote: (id: string) => void;
  onTogglePinned: (id: string) => void;
  onOpenAllNotes: (scopeType: NoteScopeType, scopeRef: string | null, noteId?: string | null) => void;
}> = ({ title, scopeType, scopeRef, notes, onAddNote, onUpdateNote, onDeleteNote, onTogglePinned, onOpenAllNotes }) => {
  const sortedNotes = React.useMemo(() => sortNotes(notes).slice(0, 3), [notes]);
  const [selectedNoteId, setSelectedNoteId] = React.useState<string | null>(sortedNotes[0]?.id ?? null);

  React.useEffect(() => {
    if (!sortedNotes.length) {
      setSelectedNoteId(null);
      return;
    }
    if (!selectedNoteId || !sortedNotes.some((note) => note.id === selectedNoteId)) {
      setSelectedNoteId(sortedNotes[0].id);
    }
  }, [selectedNoteId, sortedNotes]);

  const selectedNote = sortedNotes.find((note) => note.id === selectedNoteId) ?? null;

  const handleCreate = () => {
    const note = onAddNote({ scopeType, scopeRef });
    setSelectedNoteId(note.id);
  };

  return (
    <section className="mb-6">
      <div className="panel-muted rounded-[28px] border soft-divider px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--accent)]">{title}</div>
            <div className="mt-1 text-[12px] text-[var(--text-secondary)]">
              {notes.length ? `${notes.length} note${notes.length === 1 ? '' : 's'} in this scope` : 'Capture context without leaving this view.'}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCreate}
              className="inline-flex items-center gap-1 rounded-full bg-[var(--accent)] px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--accent-contrast)] transition-transform hover:scale-[1.02]"
            >
              <Plus size={12} />
              New note
            </button>
            <button
              type="button"
              onClick={() => onOpenAllNotes(scopeType, scopeRef, selectedNote?.id ?? null)}
              className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--text-secondary)] transition-colors hover:bg-[rgba(255,255,255,0.04)] hover:text-[var(--text-primary)]"
            >
              Open all
              <ArrowRight size={12} />
            </button>
          </div>
        </div>

        {sortedNotes.length > 0 ? (
          <div className="mt-4 space-y-3">
            <div className="grid gap-2 lg:grid-cols-3">
              {sortedNotes.map((note) => (
                <button
                  key={note.id}
                  type="button"
                  onClick={() => setSelectedNoteId(note.id)}
                  className={`rounded-2xl border px-3 py-3 text-left transition-colors ${selectedNote?.id === note.id ? 'border-[var(--accent)]/50 bg-[var(--accent-soft)]/40' : 'soft-divider hover:bg-[rgba(255,255,255,0.03)]'}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="truncate text-[13px] font-semibold text-[var(--text-primary)]">{note.title}</div>
                    {note.pinned && <Star size={12} className="fill-[var(--accent)] text-[var(--accent)]" />}
                  </div>
                  <div className="mt-1 text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--text-muted)]">
                    {formatNoteTimestamp(note.updatedAt)}
                  </div>
                  <div className="mt-2 text-[12px] leading-5 text-[var(--text-secondary)]">
                    {getMarkdownExcerpt(note.body, 100)}
                  </div>
                </button>
              ))}
            </div>

            {selectedNote && (
              <NoteEditorCard
                note={selectedNote}
                scopeLabel={title}
                onUpdateNote={onUpdateNote}
                onDeleteNote={onDeleteNote}
                onTogglePinned={onTogglePinned}
              />
            )}
          </div>
        ) : (
          <div className="mt-4 rounded-2xl border border-dashed soft-divider px-4 py-5 text-[12px] text-[var(--text-secondary)]">
            No notes yet for this scope.
          </div>
        )}
      </div>
    </section>
  );
};
