import React, { useEffect, useState } from 'react';
import { Eye, Pencil } from 'lucide-react';
import { renderMarkdown } from '../lib/markdown';

export const MarkdownEditor: React.FC<{
  value: string;
  onChange: (value: string) => void;
  minHeightClassName?: string;
}> = ({ value, onChange, minHeightClassName = 'min-h-[160px]' }) => {
  const [isEditing, setIsEditing] = useState(!value.trim());

  useEffect(() => {
    if (!value.trim()) setIsEditing(true);
  }, [value]);

  return (
    <div
      className="space-y-2"
      onClick={(event) => event.stopPropagation()}
      onDoubleClick={(event) => event.stopPropagation()}
      onKeyDownCapture={(event) => event.stopPropagation()}
    >
      <div className="flex items-center justify-between">
        <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--text-muted)]">Notes</label>
        <div className="flex items-center gap-1 rounded-full bg-[rgba(255,255,255,0.04)] p-1 text-[11px]">
          <button
            type="button"
            className={`rounded-full px-2.5 py-1 transition-colors ${isEditing ? 'bg-[rgba(255,255,255,0.08)] text-[var(--text-primary)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
            onClick={() => setIsEditing(true)}
          >
            <span className="flex items-center gap-1"><Pencil size={11} /> Edit</span>
          </button>
          <button
            type="button"
            className={`rounded-full px-2.5 py-1 transition-colors ${!isEditing ? 'bg-[rgba(255,255,255,0.08)] text-[var(--text-primary)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
            onClick={() => setIsEditing(false)}
          >
            <span className="flex items-center gap-1"><Eye size={11} /> Preview</span>
          </button>
        </div>
      </div>

      <div className={`rounded-xl bg-[rgba(255,255,255,0.02)] px-0 py-0 ${minHeightClassName}`}>
        {isEditing ? (
          <textarea
            autoFocus
            value={value}
            onChange={(event) => onChange(event.target.value)}
            onKeyDown={(event) => {
              event.stopPropagation();
            }}
            placeholder="Use markdown for headings, lists, emphasis, links, and inline code."
            className={`markdown-preview h-full w-full resize-y bg-transparent px-0 py-0 text-[12px] leading-relaxed text-[var(--text-secondary)] outline-none placeholder:text-[var(--text-muted)] ${minHeightClassName}`}
            spellCheck={false}
          />
        ) : (
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            className={`markdown-preview block h-full w-full bg-transparent px-0 py-0 text-left text-[12px] leading-relaxed text-[var(--text-secondary)] ${minHeightClassName}`}
            dangerouslySetInnerHTML={{ __html: renderMarkdown(value) }}
          />
        )}
      </div>
    </div>
  );
};
