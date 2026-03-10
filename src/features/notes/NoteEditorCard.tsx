import React from 'react';
import { Star } from 'lucide-react';
import { MarkdownEditor } from '../../components/MarkdownEditor';
import { Note } from '../../types';
import { formatNoteTimestamp } from './noteUtils';

/** Inline note editor content — title input, body editor, pin/delete actions. No card wrapper. */
export const NoteEditorCard: React.FC<{
  note: Note;
  scopeLabel: string;
  onUpdateNote: (id: string, updates: Partial<Note>) => void;
  onDeleteNote: (id: string) => void;
  onTogglePinned: (id: string) => void;
}> = ({ note, scopeLabel, onUpdateNote, onDeleteNote, onTogglePinned }) => (
  <div>
    <div className="mb-1 text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--accent)]">{scopeLabel}</div>
    <input
      type="text"
      value={note.title}
      onChange={(event) => onUpdateNote(note.id, { title: event.target.value })}
      placeholder="Untitled note"
      className="mb-1 w-full bg-transparent text-[22px] font-semibold tracking-[-0.03em] text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)]"
    />
    <div className="mb-3 text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--text-muted)]">
      Updated {formatNoteTimestamp(note.updatedAt)}
    </div>
    <MarkdownEditor value={note.body} onChange={(value) => onUpdateNote(note.id, { body: value })} minHeightClassName="min-h-[180px]" />
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
        onClick={() => onDeleteNote(note.id)}
        className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--danger)] transition-colors hover:bg-[var(--danger-soft)]/20"
      >
        Delete
      </button>
    </div>
  </div>
);

