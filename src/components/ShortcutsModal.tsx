import React from 'react';
import { X } from 'lucide-react';

interface ShortcutRowProps {
  label: string;
  keys: string[];
}

const ShortcutRow: React.FC<ShortcutRowProps> = ({ label, keys }) => (
  <div className="flex items-center justify-between gap-4">
    <span className="text-[var(--text-secondary)]">{label}</span>
    <span className="flex shrink-0 items-center gap-1">
      {keys.map((k, i) => (
        <React.Fragment key={i}>
          {i > 0 && <span className="text-[10px] text-[var(--text-muted)]">then</span>}
          <kbd className="rounded bg-[var(--panel-bg)] px-1.5 py-0.5 text-[11px] font-semibold text-[var(--text-primary)] shadow-[0_1px_0_1px_var(--border-color)]">
            {k}
          </kbd>
        </React.Fragment>
      ))}
    </span>
  </div>
);

interface SectionProps {
  title: string;
  children: React.ReactNode;
}

const Section: React.FC<SectionProps> = ({ title, children }) => (
  <div className="space-y-2.5">
    <div className="mb-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--text-muted)]">{title}</div>
    {children}
  </div>
);

export const ShortcutsModal: React.FC<{ onClose: () => void }> = ({ onClose }) => (
  <div
    className="fixed inset-0 z-[2200] flex items-center justify-center bg-[var(--overlay)] p-4 backdrop-blur-sm"
    onClick={onClose}
  >
    <div
      className="panel-surface w-full max-w-lg rounded-[28px] p-8"
      onClick={(event) => event.stopPropagation()}
    >
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-[28px] font-semibold leading-none tracking-[-0.04em] text-[var(--text-primary)]">
          Keyboard Shortcuts
        </h2>
        <button
          type="button"
          onClick={onClose}
          className="text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)]"
        >
          <X size={20} />
        </button>
      </div>

      <div className="grid gap-5 text-sm sm:grid-cols-2">
        <Section title="Navigation">
          <ShortcutRow label="Focus new task input" keys={['N']} />
          <ShortcutRow label="Search" keys={['/']} />
          <ShortcutRow label="Go to Planner" keys={['8']} />
          <ShortcutRow label="Go to view (Inbox → Completed)" keys={['1 – 7']} />
          <ShortcutRow label="Go to Today" keys={['T']} />
          <ShortcutRow label="Go to Settings" keys={[',']} />
          <ShortcutRow label="Cycle areas" keys={['Shift + [', ']']} />
          <ShortcutRow label="Toggle sidebar" keys={['Ctrl/Cmd + B']} />
          <ShortcutRow label="Toggle completed tasks" keys={['H']} />
        </Section>

        <Section title="Global">
          <ShortcutRow label="Command palette" keys={['Ctrl/Cmd + K']} />
          <ShortcutRow label="Keyboard shortcuts" keys={['K']} />
          <ShortcutRow label="New inbox item" keys={['I']} />
          <ShortcutRow label="New next action" keys={['X']} />
        </Section>

        <Section title="Outline View">
          <ShortcutRow label="Indent task" keys={['Tab']} />
          <ShortcutRow label="Outdent task" keys={['Shift + Tab']} />
          <ShortcutRow label="Move task up" keys={['Alt + ↑']} />
          <ShortcutRow label="Move task down" keys={['Alt + ↓']} />
          <ShortcutRow label="Open task detail" keys={['Enter']} />
        </Section>

        <Section title="Timer">
          <ShortcutRow label="Pause / Resume" keys={['Space']} />
          <ShortcutRow label="Stop timer" keys={['Esc']} />
          <ShortcutRow label="Pop-out toggle" keys={['P']} />
          <ShortcutRow label="Minimize / Expand" keys={['M']} />
        </Section>
      </div>

      <div className="mt-6 border-t pt-4 soft-divider">
        <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--text-muted)] mb-2.5">Add Item (Day View Ghost Input)</div>
        <div className="grid gap-2.5 text-sm sm:grid-cols-2">
          <ShortcutRow label="Mark next as subtask" keys={['Tab']} />
          <ShortcutRow label="Navigate day sections" keys={['↑ / ↓']} />
        </div>
      </div>
    </div>
  </div>
);
