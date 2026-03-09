import React, { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';

export interface CommandItem {
  id: string;
  label: string;
  hint?: string;
  run: () => void;
  disabled?: boolean;
}

export const CommandPalette: React.FC<{
  open: boolean;
  commands: CommandItem[];
  resolveQuery?: (query: string) => CommandItem[] | null;
  onClose: () => void;
}> = ({ open, commands, resolveQuery, onClose }) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const trimmedQuery = query.trim();
  const resolvedCommands = useMemo(() => resolveQuery?.(trimmedQuery) ?? null, [resolveQuery, trimmedQuery]);

  const filtered = useMemo(() => {
    if (resolvedCommands !== null) return resolvedCommands;
    const normalized = trimmedQuery.toLowerCase();
    if (!normalized) return commands;
    return commands.filter((command) => `${command.label} ${command.hint || ''}`.toLowerCase().includes(normalized));
  }, [commands, resolvedCommands, trimmedQuery]);

  React.useEffect(() => {
    if (!open) {
      setQuery('');
      setSelectedIndex(0);
    }
  }, [open]);

  React.useEffect(() => {
    setSelectedIndex(filtered.length > 0 ? 0 : -1);
  }, [filtered]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[2400] bg-[var(--overlay)] p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="panel-surface mx-auto mt-[10vh] w-full max-w-xl overflow-hidden rounded-3xl" onClick={(event) => event.stopPropagation()}>
        <input
          autoFocus
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown') {
              event.preventDefault();
              setSelectedIndex((index) => Math.min(filtered.length - 1, Math.max(index, 0) + 1));
            } else if (event.key === 'ArrowUp') {
              event.preventDefault();
              setSelectedIndex((index) => Math.max(0, index - 1));
            } else if (event.key === 'Enter') {
              event.preventDefault();
              const command = filtered[selectedIndex];
              if (!command || command.disabled) return;
              command.run();
              onClose();
            } else if (event.key === 'Escape') {
              event.preventDefault();
              onClose();
            }
          }}
          placeholder="Run a command... (s:search, t:new task, note:idea, timer:25 focus)"
          className="w-full border-b soft-divider bg-transparent px-5 py-4 text-sm text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)]"
        />
        <div className="max-h-[50vh] overflow-y-auto p-2">
          {filtered.map((command, index) => (
            <button
              key={command.id}
              type="button"
              onMouseEnter={() => setSelectedIndex(index)}
              disabled={command.disabled}
              onClick={() => {
                if (command.disabled) return;
                command.run();
                onClose();
              }}
              className={`relative flex w-full items-center justify-between rounded-xl px-4 py-2.5 text-left transition-all ${command.disabled ? 'cursor-default opacity-70' : ''} ${selectedIndex === index ? 'bg-[var(--accent-soft)]/85 text-[var(--text-primary)] shadow-[0_0_0_1px_color-mix(in_srgb,var(--accent)_70%,transparent),0_8px_22px_rgba(0,0,0,0.22)] ring-1 ring-[color-mix(in_srgb,var(--accent)_35%,transparent)]' : 'text-[var(--text-primary)] hover:bg-[rgba(255,255,255,0.05)]'}`}
            >
              {selectedIndex === index && <span className="absolute bottom-2 left-1 top-2 w-0.5 rounded-full bg-[var(--accent)]" />}
              <span className="text-[var(--text-primary)]">{command.label}</span>
              {command.hint && <span className="text-xs uppercase tracking-[0.2em] text-[var(--text-muted)]">{command.hint}</span>}
            </button>
          ))}
          {filtered.length === 0 && <div className="px-4 py-6 text-sm text-[var(--text-secondary)]">No matching commands.</div>}
        </div>
      </div>
    </div>,
    document.body
  );
};
