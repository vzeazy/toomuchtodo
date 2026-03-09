import React from 'react';
import { Star, Trash2 } from 'lucide-react';
import { MarkdownEditor } from '../../components/MarkdownEditor';
import { Note } from '../../types';
import { formatNoteTimestamp } from './noteUtils';

export const NoteEditorCard: React.FC<{
  note: Note;
  scopeLabel: string;
  onUpdateNote: (id: string, updates: Partial<Note>) => void;
  onDeleteNote: (id: string) => void;
  onTogglePinned: (id: string) => void;
}> = ({ note, scopeLabel, onUpdateNote, onDeleteNote, onTogglePinned }) => (
  <div className="panel-surface rounded-[28px] p-5">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0 flex-1">
        <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--accent)]">{scopeLabel}</div>
        <input
          type="text"
          value={note.title}
          onChange={(event) => onUpdateNote(note.id, { title: event.target.value })}
          placeholder="Untitled note"
          className="mt-2 w-full bg-transparent text-[24px] font-medium tracking-[-0.04em] text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)]"
        />
        <div className="mt-2 text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--text-muted)]">
          Updated {formatNoteTimestamp(note.updatedAt)}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onTogglePinned(note.id)}
          className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.12em] transition-colors ${note.pinned ? 'bg-[var(--accent-soft)] text-[var(--accent)]' : 'panel-muted border soft-divider text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
        >
          <Star size={12} className={note.pinned ? 'fill-current' : ''} />
          {note.pinned ? 'Pinned' : 'Pin'}
        </button>
        <button
          type="button"
          onClick={() => onDeleteNote(note.id)}
          className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--danger)] transition-colors hover:bg-[var(--danger-soft)]/20"
        >
          <Trash2 size={12} />
          Delete
        </button>
      </div>
    </div>

    <div className="mt-4">
      <MarkdownEditor value={note.body} onChange={(value) => onUpdateNote(note.id, { body: value })} minHeightClassName="min-h-[220px]" />
    </div>
  </div>
);
