import React from 'react';
import { Ellipsis, ExternalLink, Pin, Plus, Star, Trash2 } from 'lucide-react';
import { Note } from '../../types';
import { renderMarkdown } from '../../lib/markdown';
import { formatNoteTimestamp, getNoteTitleFromBody } from './noteUtils';

export const NotesModule: React.FC<{
  notes: Note[];
  activeNoteId: string | null;
  onSetActiveNoteId: (id: string) => void;
  onAddNote: (body: string) => Note;
  onUpdateNote: (id: string, updates: Partial<Note>) => void;
  onDeleteNote: (id: string) => void;
  onTogglePinned: (id: string) => void;
  onReorderNotes: (noteIds: string[]) => void;
  onOpenInDashboard: (noteId?: string | null) => void;
}> = ({
  notes,
  activeNoteId,
  onSetActiveNoteId,
  onAddNote,
  onUpdateNote,
  onDeleteNote,
  onTogglePinned,
  onReorderNotes,
  onOpenInDashboard,
}) => {
  const [editingNoteId, setEditingNoteId] = React.useState<string | null>(null);
  const [draftBody, setDraftBody] = React.useState('');
  const [isMenuOpenForNoteId, setIsMenuOpenForNoteId] = React.useState<string | null>(null);
  const [draggingNoteId, setDraggingNoteId] = React.useState<string | null>(null);
  const [dragOverNoteId, setDragOverNoteId] = React.useState<string | null>(null);
  const [isDraftingNew, setIsDraftingNew] = React.useState(false);
  const [newDraftBody, setNewDraftBody] = React.useState('');

  const menuRef = React.useRef<HTMLDivElement>(null);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const newDraftTextareaRef = React.useRef<HTMLTextAreaElement>(null);
  const editingNote = notes.find((note) => note.id === editingNoteId) ?? null;

  const resizeTextarea = React.useCallback((el: HTMLTextAreaElement | null) => {
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, []);

  React.useEffect(() => {
    if (!editingNote) return;
    setDraftBody(editingNote.body);
  }, [editingNote?.id, editingNote?.body]);

  React.useEffect(() => {
    if (!editingNoteId) return;
    resizeTextarea(textareaRef.current);
  }, [draftBody, editingNoteId, resizeTextarea]);

  React.useEffect(() => {
    if (!isDraftingNew) return;
    resizeTextarea(newDraftTextareaRef.current);
  }, [isDraftingNew, newDraftBody, resizeTextarea]);

  React.useEffect(() => {
    if (!isMenuOpenForNoteId) return;
    const onPointerDown = (event: MouseEvent) => {
      if (menuRef.current?.contains(event.target as Node)) return;
      setIsMenuOpenForNoteId(null);
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [isMenuOpenForNoteId]);

  const commitBody = React.useCallback((note: Note) => {
    if (draftBody === note.body) return;
    onUpdateNote(note.id, { body: draftBody, title: getNoteTitleFromBody(draftBody) });
  }, [draftBody, onUpdateNote]);

  const commitNewDraft = React.useCallback(() => {
    const normalizedBody = newDraftBody.trim();
    if (!normalizedBody) {
      setIsDraftingNew(false);
      setNewDraftBody('');
      return;
    }
    const note = onAddNote(newDraftBody);
    onSetActiveNoteId(note.id);
    setIsDraftingNew(false);
    setNewDraftBody('');
  }, [newDraftBody, onAddNote, onSetActiveNoteId]);

  const cancelNewDraft = React.useCallback(() => {
    setIsDraftingNew(false);
    setNewDraftBody('');
  }, []);

  const handleDropOnNote = (targetId: string) => {
    if (!draggingNoteId || draggingNoteId === targetId) return;
    const currentIds = notes.map((note) => note.id);
    const sourceIndex = currentIds.indexOf(draggingNoteId);
    const targetIndex = currentIds.indexOf(targetId);
    if (sourceIndex < 0 || targetIndex < 0) return;

    const nextIds = [...currentIds];
    nextIds.splice(sourceIndex, 1);
    const insertIndex = nextIds.indexOf(targetId);
    nextIds.splice(insertIndex, 0, draggingNoteId);
    onReorderNotes(nextIds);
    setDragOverNoteId(null);
    setDraggingNoteId(null);
  };

  return (
    <section className="mx-auto mt-10 max-w-5xl px-[2px]">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="section-kicker text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--text-muted)]">Notes</div>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {notes.map((note) => {
          const isEditing = editingNoteId === note.id;
          const isDragOver = dragOverNoteId === note.id && draggingNoteId !== note.id;

          return (
            <article
              key={note.id}
              draggable={!isEditing && !isDraftingNew}
              onDragStart={(event) => {
                setDraggingNoteId(note.id);
                event.dataTransfer.effectAllowed = 'move';
                event.dataTransfer.setData('text/plain', note.id);
              }}
              onDragOver={(event) => {
                if (!draggingNoteId || draggingNoteId === note.id) return;
                event.preventDefault();
                event.dataTransfer.dropEffect = 'move';
                setDragOverNoteId(note.id);
              }}
              onDragLeave={() => {
                if (dragOverNoteId === note.id) setDragOverNoteId(null);
              }}
              onDrop={(event) => {
                event.preventDefault();
                handleDropOnNote(note.id);
              }}
              onDragEnd={() => {
                setDraggingNoteId(null);
                setDragOverNoteId(null);
              }}
              className={`group rounded-[20px] border border-[color:color-mix(in_srgb,var(--border-color)_55%,transparent)] bg-[color:color-mix(in_srgb,var(--panel-alt-bg)_66%,transparent)] px-4 py-3 transition-colors ${isDragOver ? 'border-[var(--accent-soft)] bg-[var(--accent-soft)]/15' : ''}`}
            >
              <div className="mb-2 flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 text-[12px] font-medium text-[var(--text-primary)]">
                      <span className="truncate">{getNoteTitleFromBody(note.body)}</span>
                      {note.pinned && <Star size={10} className="fill-[var(--accent)] text-[var(--accent)]" />}
                    </div>
                  <div className="mt-0.5 text-[10px] uppercase tracking-[0.12em] text-[var(--text-muted)]">
                    Updated {formatNoteTimestamp(note.updatedAt)}
                  </div>
                </div>

                <div ref={isMenuOpenForNoteId === note.id ? menuRef : undefined} className="relative">
                  <button
                    type="button"
                    onClick={() => {
                      onSetActiveNoteId(note.id);
                      setIsMenuOpenForNoteId((prev) => (prev === note.id ? null : note.id));
                    }}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-full text-[var(--text-muted)] opacity-0 transition hover:bg-[var(--panel-alt-bg)] hover:text-[var(--text-primary)] group-hover:opacity-100 focus-visible:opacity-100"
                    aria-label="Open note actions"
                  >
                    <Ellipsis size={15} />
                  </button>
                  {isMenuOpenForNoteId === note.id && (
                    <div className="panel-surface absolute right-0 top-full z-20 mt-1 min-w-[180px] rounded-xl border border-[color:color-mix(in_srgb,var(--border-color)_65%,transparent)] py-1">
                      <button
                        type="button"
                        onClick={() => {
                          onTogglePinned(note.id);
                          setIsMenuOpenForNoteId(null);
                        }}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] text-[var(--text-primary)] transition-colors hover:bg-[var(--panel-alt-bg)]"
                      >
                        <Pin size={12} />
                        {note.pinned ? 'Unpin note' : 'Pin note'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          onOpenInDashboard(note.id);
                          setIsMenuOpenForNoteId(null);
                        }}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] text-[var(--text-primary)] transition-colors hover:bg-[var(--panel-alt-bg)]"
                      >
                        <ExternalLink size={12} />
                        Open in notes
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          onDeleteNote(note.id);
                          if (editingNoteId === note.id) {
                            setEditingNoteId(null);
                            setDraftBody('');
                          }
                          setIsMenuOpenForNoteId(null);
                        }}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] text-[var(--danger)] transition-colors hover:bg-[var(--panel-alt-bg)]"
                      >
                        <Trash2 size={12} />
                        Delete note
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {isEditing ? (
                <>
                  <textarea
                    ref={textareaRef}
                    value={draftBody}
                    onChange={(event) => setDraftBody(event.target.value)}
                    onBlur={() => {
                      commitBody(note);
                      setEditingNoteId(null);
                    }}
                    onKeyDown={(event) => {
                      if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
                        event.preventDefault();
                        commitBody(note);
                        setEditingNoteId(null);
                        return;
                      }
                      if (event.key === 'Escape') {
                        event.preventDefault();
                        setDraftBody(note.body);
                        setEditingNoteId(null);
                      }
                    }}
                    placeholder="Write a note..."
                    className="w-full resize-none overflow-hidden bg-transparent text-[13px] leading-6 text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)]"
                    autoFocus
                  />
                  <div className="mt-1 text-[10px] text-[var(--text-muted)]">
                    Blur saves · Ctrl/Cmd+Enter saves and exits · Esc cancels
                  </div>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    onSetActiveNoteId(note.id);
                    setEditingNoteId(note.id);
                    setDraftBody(note.body);
                  }}
                    className="markdown-preview block w-full text-left text-[13px] leading-6 text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
                  >
                  {note.body.trim() ? (
                    <div className="line-clamp-8" dangerouslySetInnerHTML={{ __html: renderMarkdown(note.body) }} />
                  ) : (
                    'Click to start writing...'
                  )}
                </button>
              )}
            </article>
          );
        })}

        {isDraftingNew ? (
          <article className="rounded-[20px] border border-[color:color-mix(in_srgb,var(--border-color)_55%,transparent)] bg-[color:color-mix(in_srgb,var(--panel-alt-bg)_66%,transparent)] px-4 py-3">
            <div className="mb-2 text-[10px] uppercase tracking-[0.12em] text-[var(--text-muted)]">
              New note
            </div>
            <textarea
              ref={newDraftTextareaRef}
              value={newDraftBody}
              onChange={(event) => setNewDraftBody(event.target.value)}
              onBlur={commitNewDraft}
              onKeyDown={(event) => {
                if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
                  event.preventDefault();
                  commitNewDraft();
                  return;
                }
                if (event.key === 'Escape') {
                  event.preventDefault();
                  cancelNewDraft();
                }
              }}
              placeholder="Write a note..."
              className="w-full resize-none overflow-hidden bg-transparent text-[13px] leading-6 text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)]"
              autoFocus
            />
            <div className="mt-1 text-[10px] text-[var(--text-muted)]">
              Type to create · Blur saves · Ctrl/Cmd+Enter saves and exits · Esc cancels
            </div>
          </article>
        ) : (
          <button
            type="button"
            onClick={() => {
              setIsDraftingNew(true);
              setNewDraftBody('');
            }}
            className="rounded-[20px] border border-[color:color-mix(in_srgb,var(--border-color)_55%,transparent)] bg-[color:color-mix(in_srgb,var(--panel-alt-bg)_66%,transparent)] px-4 py-3 text-left transition-colors hover:border-[var(--accent-soft)]"
          >
            <div className="mb-2 text-[10px] uppercase tracking-[0.12em] text-[var(--text-muted)]">New note</div>
            <div className="flex items-start gap-2 text-[13px] leading-6 text-[var(--text-muted)]">
              <Plus size={12} className="mt-[6px] shrink-0" />
              <span>Write a note...</span>
            </div>
          </button>
        )}
      </div>
    </section>
  );
};
