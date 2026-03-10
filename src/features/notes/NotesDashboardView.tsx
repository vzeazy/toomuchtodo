import React from 'react';
import { FileText, FolderOpen, LayoutGrid, LayoutList, Minus, Plus, Search, Star, X } from 'lucide-react';
import { getMarkdownExcerpt } from '../../lib/markdown';
import { Note, NoteListPreview, NoteViewLayout, NoteScopeType, Project } from '../../types';
import { NoteScopeFilter, formatNoteTimestamp, getScopeLabel, sortNotes } from './noteUtils';

const FILTERS: Array<{ id: NoteScopeFilter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'dashboard', label: 'General' },
  { id: 'project', label: 'Projects' },
  { id: 'area', label: 'Areas' },
  { id: 'day', label: 'Days' },
];

const PREVIEW_OPTIONS: Array<{ id: NoteListPreview; label: string; icon: React.FC<{ size?: number; className?: string }> }> = [
  { id: 'none', label: 'None', icon: ({ size = 13, ...p }) => <Minus size={size} {...p} /> },
  { id: 'line1', label: '1 line', icon: ({ size = 13, ...p }) => <LayoutList size={size} {...p} /> },
  { id: 'line3', label: '3 lines', icon: ({ size = 13, ...p }) => <FileText size={size} {...p} /> },
];

export const NotesDashboardView: React.FC<{
  notes: Note[];
  projects: Project[];
  focusState: { scopeType: NoteScopeFilter; scopeRef: string | null; noteId: string | null };
  notesListPreview: NoteListPreview;
  notesViewLayout: NoteViewLayout;
  onAddNote: (input: { scopeType: NoteScopeType; scopeRef: string | null }) => Note;
  onUpdateNote: (id: string, updates: Partial<Note>) => void;
  onDeleteNote: (id: string) => void;
  onTogglePinned: (id: string) => void;
  onSetNotesListPreview: (mode: NoteListPreview) => void;
  onSetNotesViewLayout: (layout: NoteViewLayout) => void;
}> = ({
  notes,
  projects,
  focusState,
  notesListPreview,
  notesViewLayout,
  onAddNote,
  onUpdateNote,
  onDeleteNote,
  onTogglePinned,
  onSetNotesListPreview,
  onSetNotesViewLayout,
}) => {
  const [query, setQuery] = React.useState('');
  const [scopeFilter, setScopeFilter] = React.useState<NoteScopeFilter>(focusState.scopeType);
  const [expandedNoteId, setExpandedNoteId] = React.useState<string | null>(focusState.noteId);

  // Local draft state for the active editor
  const [draftTitle, setDraftTitle] = React.useState('');
  const [draftBody, setDraftBody] = React.useState('');
  const draftRef = React.useRef({ title: '', body: '' });
  const saveTimeoutRef = React.useRef<ReturnType<typeof setTimeout>>();
  const [showProjectPicker, setShowProjectPicker] = React.useState(false);
  const projectPickerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    setScopeFilter(focusState.scopeType);
    setExpandedNoteId(focusState.noteId);
  }, [focusState.noteId, focusState.scopeType, focusState.scopeRef]);

  // Load draft when expanding a note
  React.useEffect(() => {
    if (expandedNoteId) {
      const note = notes.find((n) => n.id === expandedNoteId);
      if (note) {
        setDraftTitle(note.title);
        setDraftBody(note.body);
        draftRef.current = { title: note.title, body: note.body };
      }
    } else {
      // Flush pending save when collapsing
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    }
    setShowProjectPicker(false);
  }, [expandedNoteId]); // intentionally not depending on notes to avoid overwriting drafts

  // Close project picker on outside click
  React.useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (projectPickerRef.current && !projectPickerRef.current.contains(e.target as Node)) {
        setShowProjectPicker(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const scheduleSave = (id: string) => {
    clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      onUpdateNote(id, { title: draftRef.current.title, body: draftRef.current.body });
    }, 800);
  };

  const flushSave = (id: string) => {
    clearTimeout(saveTimeoutRef.current);
    onUpdateNote(id, { title: draftRef.current.title, body: draftRef.current.body });
  };

  const handleTitleChange = (value: string) => {
    setDraftTitle(value);
    draftRef.current.title = value;
    if (expandedNoteId) scheduleSave(expandedNoteId);
  };

  const handleBodyChange = (value: string) => {
    setDraftBody(value);
    draftRef.current.body = value;
    if (expandedNoteId) scheduleSave(expandedNoteId);
  };

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
    if (expandedNoteId && expandedNoteId !== noteId) {
      flushSave(expandedNoteId);
    }
    setExpandedNoteId((prev) => (prev === noteId ? null : noteId));
  };

  const handleCollapse = () => {
    if (expandedNoteId) flushSave(expandedNoteId);
    setExpandedNoteId(null);
  };

  const handleDelete = (noteId: string) => {
    clearTimeout(saveTimeoutRef.current);
    onDeleteNote(noteId);
    setExpandedNoteId(null);
  };

  const activeProjects = React.useMemo(() => projects.filter((p) => p.deletedAt === null), [projects]);

  const getProjectName = (note: Note) => {
    if (note.scopeType !== 'project' || !note.scopeRef) return null;
    return activeProjects.find((p) => p.id === note.scopeRef)?.name ?? 'Unknown project';
  };

  const handleSetNoteProject = (noteId: string, projectId: string | null) => {
    if (projectId) {
      onUpdateNote(noteId, { scopeType: 'project', scopeRef: projectId });
    } else {
      onUpdateNote(noteId, { scopeType: 'dashboard', scopeRef: null });
    }
    setShowProjectPicker(false);
  };

  const renderEditor = (note: Note) => {
    const projectName = getProjectName(note);
    return (
      <div className="border-t soft-divider px-5 pb-5 pt-4">
        {/* Unified title + body editor */}
        <input
          type="text"
          value={draftTitle}
          onChange={(e) => handleTitleChange(e.target.value)}
          onBlur={() => expandedNoteId && flushSave(expandedNoteId)}
          placeholder="Note title"
          className="mb-2 w-full bg-transparent text-[20px] font-semibold tracking-[-0.025em] text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)]"
          autoFocus
        />
        <textarea
          value={draftBody}
          onChange={(e) => handleBodyChange(e.target.value)}
          onBlur={() => expandedNoteId && flushSave(expandedNoteId)}
          placeholder="Write something…"
          rows={6}
          className="w-full resize-none bg-transparent text-[13px] leading-6 text-[var(--text-secondary)] outline-none placeholder:text-[var(--text-muted)]"
        />
        {/* Actions row */}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => onTogglePinned(note.id)}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.12em] transition-colors ${note.pinned ? 'bg-[var(--accent-soft)] text-[var(--accent)]' : 'panel-muted border soft-divider text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
          >
            <Star size={11} className={note.pinned ? 'fill-current' : ''} />
            {note.pinned ? 'Pinned' : 'Pin'}
          </button>

          {/* Project attachment */}
          <div className="relative" ref={projectPickerRef}>
            <button
              type="button"
              onClick={() => setShowProjectPicker((p) => !p)}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.12em] transition-colors ${projectName ? 'bg-[var(--accent-soft)] text-[var(--accent)]' : 'panel-muted border soft-divider text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
            >
              <FolderOpen size={11} />
              {projectName ?? 'Attach project'}
            </button>
            {showProjectPicker && (
              <div className="panel-surface absolute left-0 top-full z-50 mt-1 min-w-[180px] rounded-2xl py-1 shadow-lg border soft-divider">
                {projectName && (
                  <button
                    type="button"
                    onClick={() => handleSetNoteProject(note.id, null)}
                    className="flex w-full items-center gap-2 px-4 py-2 text-left text-[12px] text-[var(--danger)] transition-colors hover:bg-[var(--panel-alt-bg)]"
                  >
                    <X size={11} /> Detach project
                  </button>
                )}
                {activeProjects.length === 0 && (
                  <div className="px-4 py-2 text-[12px] text-[var(--text-muted)]">No projects</div>
                )}
                {activeProjects.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleSetNoteProject(note.id, p.id)}
                    className={`flex w-full items-center gap-2 px-4 py-2 text-left text-[12px] transition-colors hover:bg-[var(--panel-alt-bg)] ${note.scopeRef === p.id ? 'text-[var(--accent)] font-semibold' : 'text-[var(--text-primary)]'}`}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => handleDelete(note.id)}
            className="ml-auto inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--danger)] transition-colors hover:bg-[var(--danger-soft)]/20"
          >
            Delete
          </button>
        </div>
      </div>
    );
  };

  const renderListRow = (note: Note, isLast: boolean) => {
    const isExpanded = expandedNoteId === note.id;
    const scopeLabel = getScopeLabel(note.scopeType, note.scopeRef, projects);
    const bodyExcerpt = getMarkdownExcerpt(note.body, 200);

    return (
      <div key={note.id} className={!isLast ? 'border-b soft-divider' : ''}>
        <button
          type="button"
          onClick={() => handleRowClick(note.id)}
          className={`w-full px-5 py-3.5 text-left transition-colors hover:bg-[rgba(255,255,255,0.03)] ${isExpanded ? 'bg-[rgba(255,255,255,0.03)]' : ''}`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate text-[13px] font-medium text-[var(--text-primary)]">
                  {note.title || 'Untitled'}
                </span>
                {note.pinned && <Star size={11} className="shrink-0 fill-[var(--accent)] text-[var(--accent)]" />}
              </div>
              <div className="mt-0.5 flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--text-muted)]">
                <span>{formatNoteTimestamp(note.updatedAt)}</span>
                {note.scopeType === 'project' && note.scopeRef && (
                  <>
                    <span>·</span>
                    <span className="text-[var(--accent)]">{scopeLabel.replace('Project · ', '')}</span>
                  </>
                )}
              </div>
              {!isExpanded && bodyExcerpt && notesListPreview !== 'none' && (
                <div className={`mt-1 text-[12px] leading-5 text-[var(--text-secondary)] ${notesListPreview === 'line1' ? 'line-clamp-1' : 'line-clamp-3'}`}>
                  {bodyExcerpt}
                </div>
              )}
            </div>
          </div>
        </button>
        {isExpanded && renderEditor(note)}
      </div>
    );
  };

  const renderCardView = () => (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {filteredNotes.map((note) => {
        const isExpanded = expandedNoteId === note.id;
        const scopeLabel = getScopeLabel(note.scopeType, note.scopeRef, projects);
        const bodyExcerpt = getMarkdownExcerpt(note.body, 180);

        if (isExpanded) {
          return (
            <div key={note.id} className="panel-surface col-span-full rounded-2xl overflow-hidden">
              <button
                type="button"
                onClick={handleCollapse}
                className="w-full px-5 py-3.5 text-left hover:bg-[rgba(255,255,255,0.03)] transition-colors"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[13px] font-medium text-[var(--text-primary)]">{note.title || 'Untitled'}</span>
                  <X size={14} className="shrink-0 text-[var(--text-muted)]" />
                </div>
              </button>
              {renderEditor(note)}
            </div>
          );
        }

        return (
          <button
            key={note.id}
            type="button"
            onClick={() => handleRowClick(note.id)}
            className="panel-surface group rounded-2xl p-4 text-left transition-all hover:border-[var(--accent-soft)] border soft-divider"
          >
            <div className="flex items-start justify-between gap-2 mb-2">
              <span className="text-[13px] font-semibold text-[var(--text-primary)] line-clamp-2 leading-5">
                {note.title || 'Untitled'}
              </span>
              {note.pinned && <Star size={11} className="mt-0.5 shrink-0 fill-[var(--accent)] text-[var(--accent)]" />}
            </div>
            {bodyExcerpt && (
              <p className="text-[12px] leading-5 text-[var(--text-secondary)] line-clamp-4 mb-3">{bodyExcerpt}</p>
            )}
            <div className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--text-muted)]">
              <span>{formatNoteTimestamp(note.updatedAt)}</span>
              {note.scopeType === 'project' && note.scopeRef && (
                <>
                  <span>·</span>
                  <span className="text-[var(--accent)]">{scopeLabel.replace('Project · ', '')}</span>
                </>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );

  return (
    <div className="mx-auto max-w-3xl">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="section-kicker mb-2 text-[10px] font-bold uppercase text-[var(--accent)]">Notes</div>
          <h1 className="text-[30px] font-semibold leading-[1.02] tracking-[-0.04em] text-[var(--text-primary)]">Notes</h1>
          <div className="mt-1.5 text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--text-muted)]">
            {filteredNotes.length} note{filteredNotes.length === 1 ? '' : 's'}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Layout toggle */}
          <div className="panel-muted flex items-center rounded-xl border soft-divider p-1">
            <button
              type="button"
              onClick={() => onSetNotesViewLayout('list')}
              className={`flex h-[28px] items-center gap-1.5 rounded-lg px-2 text-[11px] font-medium transition-all ${notesViewLayout === 'list' ? 'bg-[var(--accent-soft)] text-[var(--accent)]' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}
              title="List view"
            >
              <LayoutList size={13} />
            </button>
            <button
              type="button"
              onClick={() => onSetNotesViewLayout('card')}
              className={`flex h-[28px] items-center gap-1.5 rounded-lg px-2 text-[11px] font-medium transition-all ${notesViewLayout === 'card' ? 'bg-[var(--accent-soft)] text-[var(--accent)]' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}
              title="Card view"
            >
              <LayoutGrid size={13} />
            </button>
          </div>
          {/* Preview toggle (list only) */}
          {notesViewLayout === 'list' && (
            <div className="panel-muted flex items-center rounded-xl border soft-divider p-1">
              {PREVIEW_OPTIONS.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => onSetNotesListPreview(id)}
                  title={`Preview: ${label}`}
                  className={`flex h-[28px] items-center gap-1.5 rounded-lg px-2 text-[11px] font-medium transition-all ${notesListPreview === id ? 'bg-[var(--accent-soft)] text-[var(--accent)]' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}
                >
                  <Icon size={13} />
                  <span className="hidden sm:inline">{label}</span>
                </button>
              ))}
            </div>
          )}
          <button
            type="button"
            onClick={handleCreate}
            className="inline-flex items-center gap-1.5 rounded-full bg-[var(--accent)] px-4 py-2 text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--accent-contrast)] transition-transform hover:scale-[1.02]"
          >
            <Plus size={13} />
            New
          </button>
        </div>
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

      {/* Notes */}
      {filteredNotes.length === 0 ? (
        <div className="panel-surface rounded-[28px] px-6 py-12 text-center">
          <FileText size={22} className="mx-auto text-[var(--text-muted)]" />
          <div className="mt-4 text-[18px] font-medium text-[var(--text-primary)]">No notes yet</div>
          <div className="mt-2 text-[13px] text-[var(--text-secondary)]">
            {query ? 'Try a different search.' : 'Create your first note above.'}
          </div>
        </div>
      ) : notesViewLayout === 'card' ? (
        renderCardView()
      ) : (
        <div className="panel-surface rounded-[28px] overflow-hidden">
          {filteredNotes.map((note, index) =>
            renderListRow(note, index === filteredNotes.length - 1),
          )}
        </div>
      )}
    </div>
  );
};

