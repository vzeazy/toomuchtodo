import React from 'react';
import { FileText, Plus, Search, Star } from 'lucide-react';
import { getMarkdownExcerpt } from '../../lib/markdown';
import { Note, NoteScopeType, Project } from '../../types';
import { MarkdownEditor } from '../../components/MarkdownEditor';
import { NoteScopeFilter, formatNoteTimestamp, getScopeLabel, sortNotes } from './noteUtils';

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
  focusState: { scopeType: NoteScopeFilter; scopeRef: string | null; noteId: string | null };
  onAddNote: (input: { scopeType: NoteScopeType; scopeRef: string | null }) => Note;
  onUpdateNote: (id: string, updates: Partial<Note>) => void;
  onDeleteNote: (id: string) => void;
  onTogglePinned: (id: string) => void;
}> = ({ notes, projects, focusState, onAddNote, onUpdateNote, onDeleteNote, onTogglePinned }) => {
  const [query, setQuery] = React.useState('');
  const [scopeFilter, setScopeFilter] = React.useState<NoteScopeFilter>(focusState.scopeType);
  const [expandedNoteId, setExpandedNoteId] = React.useState<string | null>(focusState.noteId);

  React.useEffect(() => {
    setScopeFilter(focusState.scopeType);
    setExpandedNoteId(focusState.noteId);
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

  const handleCreate = () => {
    const desiredScopeType = scopeFilter === 'all' ? 'dashboard' : scopeFilter;
    const desiredScopeRef = desiredScopeType === 'dashboard' ? null : focusState.scopeRef;
    const scopeType = desiredScopeType !== 'dashboard' && desiredScopeRef === null ? 'dashboard' : desiredScopeType;
    const scopeRef = scopeType === 'dashboard' ? null : desiredScopeRef;
    const note = onAddNote({ scopeType, scopeRef });
    setExpandedNoteId(note.id);
  };

  const handleRowClick = (noteId: string) => {
    setExpandedNoteId((prev) => (prev === noteId ? null : noteId));
  };

  return (
    <div className="mx-auto max-w-3xl">
      {/* Header */}
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

      {/* Search + filters */}
      <div className="mb-5 flex flex-col gap-3">
        <label className="flex items-center gap-2 rounded-2xl border soft-divider panel-muted px-4 py-2.5 text-[var(--text-secondary)]">
          <Search size={14} className="shrink-0" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search notes…"
            className="w-full bg-transparent text-[13px] text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)]"
          />
        </label>
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
      </div>

      {/* Notes list */}
      {filteredNotes.length === 0 ? (
        <div className="panel-surface rounded-[28px] px-6 py-12 text-center">
          <FileText size={22} className="mx-auto text-[var(--text-muted)]" />
          <div className="mt-4 text-[18px] font-medium text-[var(--text-primary)]">No notes yet</div>
          <div className="mt-2 text-[13px] text-[var(--text-secondary)]">
            {query ? 'Try a different search.' : 'Create your first note with the button above.'}
          </div>
        </div>
      ) : (
        <div className="panel-surface rounded-[28px] overflow-hidden">
          {filteredNotes.map((note, index) => {
            const isExpanded = expandedNoteId === note.id;
            const scopeLabel = getScopeLabel(note.scopeType, note.scopeRef, projects);
            const isLast = index === filteredNotes.length - 1;

            return (
              <div key={note.id} className={!isLast ? 'border-b soft-divider' : ''}>
                {/* Row */}
                <button
                  type="button"
                  onClick={() => handleRowClick(note.id)}
                  className={`w-full px-6 py-4 text-left transition-colors hover:bg-[rgba(255,255,255,0.03)] ${isExpanded ? 'bg-[rgba(255,255,255,0.03)]' : ''}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-[14px] font-semibold text-[var(--text-primary)]">
                          {note.title || 'Untitled'}
                        </span>
                        {note.pinned && <Star size={12} className="shrink-0 fill-[var(--accent)] text-[var(--accent)]" />}
                      </div>
                      <div className="mt-1 flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--text-muted)]">
                        <span>{scopeLabel}</span>
                        <span>·</span>
                        <span>{formatNoteTimestamp(note.updatedAt)}</span>
                      </div>
                      {!isExpanded && note.body.trim() && (
                        <div className="mt-1.5 text-[12px] leading-5 text-[var(--text-secondary)] line-clamp-2">
                          {getMarkdownExcerpt(note.body, 160)}
                        </div>
                      )}
                    </div>
                  </div>
                </button>

                {/* Inline editor — accordion expansion */}
                {isExpanded && (
                  <div className="border-t soft-divider px-6 pb-5 pt-4">
                    <input
                      type="text"
                      value={note.title}
                      onChange={(e) => onUpdateNote(note.id, { title: e.target.value })}
                      placeholder="Untitled note"
                      className="mb-4 w-full bg-transparent text-[22px] font-semibold tracking-[-0.03em] text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)]"
                    />
                    <MarkdownEditor
                      value={note.body}
                      onChange={(value) => onUpdateNote(note.id, { body: value })}
                      minHeightClassName="min-h-[180px]"
                    />
                    <div className="mt-4 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => onTogglePinned(note.id)}
                        className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.12em] transition-colors ${note.pinned ? 'bg-[var(--accent-soft)] text-[var(--accent)]' : 'panel-muted border soft-divider text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
                      >
                        <Star size={11} className={note.pinned ? 'fill-current' : ''} />
                        {note.pinned ? 'Pinned' : 'Pin'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          onDeleteNote(note.id);
                          setExpandedNoteId(null);
                        }}
                        className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--danger)] transition-colors hover:bg-[var(--danger-soft)]/20"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

