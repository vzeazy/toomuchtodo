import React, { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';

export interface CommandItem {
  id: string;
  label: string;
  hint?: string;
  run: () => void;
}

export const CommandPalette: React.FC<{
  open: boolean;
  commands: CommandItem[];
  onClose: () => void;
}> = ({ open, commands, onClose }) => {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return commands;
    return commands.filter((command) => `${command.label} ${command.hint || ''}`.toLowerCase().includes(normalized));
  }, [commands, query]);

  React.useEffect(() => {
    if (!open) setQuery('');
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[2400] bg-[var(--overlay)] p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="panel-surface mx-auto mt-[10vh] w-full max-w-2xl overflow-hidden rounded-[30px]" onClick={(event) => event.stopPropagation()}>
        <input
          autoFocus
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Run a command..."
          className="w-full border-b soft-divider bg-transparent px-5 py-5 text-base text-[var(--text-primary)] outline-none"
        />
        <div className="max-h-[50vh] overflow-y-auto py-2">
          {filtered.map((command) => (
            <button key={command.id} type="button" onClick={() => { command.run(); onClose(); }} className="flex w-full items-center justify-between px-5 py-3 text-left transition-colors hover:bg-[rgba(255,255,255,0.03)]">
              <span className="text-[var(--text-primary)]">{command.label}</span>
              {command.hint && <span className="text-xs uppercase tracking-[0.2em] text-[var(--text-muted)]">{command.hint}</span>}
            </button>
          ))}
          {filtered.length === 0 && <div className="px-5 py-6 text-sm text-[var(--text-secondary)]">No matching commands.</div>}
        </div>
      </div>
    </div>,
    document.body
  );
};
