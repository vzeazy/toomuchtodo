import React from 'react';
import { FileText, Plus, Search, Star } from 'lucide-react';
import { getMarkdownExcerpt } from '../../lib/markdown';
import { Note, NoteScopeType, Project } from '../../types';
import { NoteEditorCard } from './NoteEditorCard';
import { NoteScopeFilter, formatNoteTimestamp, getScopeLabel, sortNotes } from './noteUtils';

type NotesFocusState = {
  scopeType: NoteScopeFilter;
  scopeRef: string | null;
  noteId: string | null;
};

const FILTERS: Array<{ id: NoteScopeFilter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'project', label: 'Projects' },
  { id: 'area', label: 'Areas' },
  { id: 'day', label: 'Days' },
];

export const NotesDashboardView: React.FC<{
  notes: Note[];
  projects: Project[];
  focusState: NotesFocusState;
  onAddNote: (input: { scopeType: NoteScopeType; scopeRef: string | null }) => Note;
  onUpdateNote: (id: string, updates: Partial<Note>) => void;
  onDeleteNote: (id: string) => void;
  onTogglePinned: (id: string) => void;
}> = ({ notes, projects, focusState, onAddNote, onUpdateNote, onDeleteNote, onTogglePinned }) => {
  const [query, setQuery] = React.useState('');
  const [scopeFilter, setScopeFilter] = React.useState<NoteScopeFilter>(focusState.scopeType);
  const [selectedNoteId, setSelectedNoteId] = React.useState<string | null>(focusState.noteId);

  React.useEffect(() => {
    setScopeFilter(focusState.scopeType);
    setSelectedNoteId(focusState.noteId);
  }, [focusState.noteId, focusState.scopeType, focusState.scopeRef]);

  const filteredNotes = React.useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return sortNotes(notes.filter((note) => {
      if (scopeFilter !== 'all' && note.scopeType !== scopeFilter) return false;
      if (focusState.scopeRef !== null && note.scopeRef !== focusState.scopeRef) return false;
      if (!normalizedQuery) return true;
      const haystack = `${note.title} ${note.body} ${getScopeLabel(note.scopeType, note.scopeRef, projects)}`.toLowerCase();
      return haystack.includes(normalizedQuery);
    }));
  }, [focusState.scopeRef, notes, projects, query, scopeFilter]);

  React.useEffect(() => {
    if (!filteredNotes.length) {
      setSelectedNoteId(null);
      return;
    }
    if (!selectedNoteId || !filteredNotes.some((note) => note.id === selectedNoteId)) {
      setSelectedNoteId(filteredNotes[0].id);
    }
  }, [filteredNotes, selectedNoteId]);

  const selectedNote = filteredNotes.find((note) => note.id === selectedNoteId) ?? null;
  const pinnedNotes = filteredNotes.filter((note) => note.pinned);
  const recentNotes = filteredNotes.filter((note) => !note.pinned);

  const handleCreate = () => {
    const desiredScopeType = scopeFilter === 'all' ? 'dashboard' : scopeFilter;
    const desiredScopeRef = desiredScopeType === 'dashboard' ? null : focusState.scopeRef;
    const scopeType = desiredScopeType !== 'dashboard' && desiredScopeRef === null ? 'dashboard' : desiredScopeType;
    const scopeRef = scopeType === 'dashboard' ? null : desiredScopeRef;
    const note = onAddNote({ scopeType, scopeRef });
    setSelectedNoteId(note.id);
  };

  const renderSection = (title: string, sectionNotes: Note[]) => (
    <section className="rounded-[28px] border soft-divider p-3">
      <div className="mb-2 px-2 text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--text-muted)]">{title}</div>
      <div className="space-y-2">
        {sectionNotes.map((note) => (
          <button
            key={note.id}
            type="button"
            onClick={() => setSelectedNoteId(note.id)}
            className={`w-full rounded-2xl px-3 py-3 text-left transition-colors ${selectedNoteId === note.id ? 'bg-[var(--accent-soft)]/45' : 'hover:bg-[rgba(255,255,255,0.03)]'}`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="truncate text-[13px] font-semibold text-[var(--text-primary)]">{note.title}</div>
                <div className="mt-1 text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--text-muted)]">
                  {getScopeLabel(note.scopeType, note.scopeRef, projects)}
                </div>
              </div>
              {note.pinned && <Star size={12} className="mt-0.5 fill-[var(--accent)] text-[var(--accent)]" />}
            </div>
            <div className="mt-2 text-[12px] leading-5 text-[var(--text-secondary)]">{getMarkdownExcerpt(note.body, 120)}</div>
            <div className="mt-2 text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--text-muted)]">
              {formatNoteTimestamp(note.updatedAt)}
            </div>
          </button>
        ))}
      </div>
    </section>
  );

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="section-kicker mb-2 text-[10px] font-bold uppercase text-[var(--accent)]">Notes</div>
          <h1 className="text-[34px] font-semibold leading-[1.02] tracking-[-0.04em] text-[var(--text-primary)]">Notes</h1>
          <div className="mt-2 text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--text-muted)]">
            {filteredNotes.length} note{filteredNotes.length === 1 ? '' : 's'}
          </div>
        </div>

        <button
          type="button"
          onClick={handleCreate}
          className="inline-flex items-center gap-2 rounded-full bg-[var(--accent)] px-4 py-2 text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--accent-contrast)] transition-transform hover:scale-[1.02]"
        >
          <Plus size={13} />
          New note
        </button>
      </div>

      <div className="mb-6 flex flex-col gap-3 rounded-[28px] border soft-divider p-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((filter) => (
            <button
              key={filter.id}
              type="button"
              onClick={() => setScopeFilter(filter.id)}
              className={`rounded-full px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.12em] transition-colors ${scopeFilter === filter.id ? 'bg-[var(--accent-soft)] text-[var(--accent)]' : 'panel-muted border soft-divider text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
            >
              {filter.label}
            </button>
          ))}
        </div>

        <label className="panel-muted flex items-center gap-2 rounded-full border soft-divider px-3 py-2 text-[var(--text-secondary)]">
          <Search size={14} />
          <input
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search note titles and bodies"
            className="w-full bg-transparent text-[13px] text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)] lg:w-72"
          />
        </label>
      </div>

      {filteredNotes.length === 0 ? (
        <div className="panel-surface rounded-[28px] px-6 py-12 text-center">
          <FileText size={22} className="mx-auto text-[var(--text-muted)]" />
          <div className="mt-4 text-[18px] font-medium text-[var(--text-primary)]">No notes found</div>
          <div className="mt-2 text-[13px] text-[var(--text-secondary)]">
            Try a different filter, or create your first note.
          </div>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(340px,420px)]">
          <div className="space-y-4">
            {pinnedNotes.length > 0 && renderSection('Pinned', pinnedNotes)}
            {recentNotes.length > 0 && renderSection('Recent', recentNotes)}
            {pinnedNotes.length === 0 && recentNotes.length === 0 && renderSection('Results', filteredNotes)}
          </div>

          <div className="lg:sticky lg:top-0 lg:self-start">
            {selectedNote && (
              <NoteEditorCard
                note={selectedNote}
                scopeLabel={getScopeLabel(selectedNote.scopeType, selectedNote.scopeRef, projects)}
                onUpdateNote={onUpdateNote}
                onDeleteNote={onDeleteNote}
                onTogglePinned={onTogglePinned}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
};
