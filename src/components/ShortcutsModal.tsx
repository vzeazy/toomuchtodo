import React from 'react';
import { X } from 'lucide-react';

export const ShortcutsModal: React.FC<{ onClose: () => void }> = ({ onClose }) => (
  <div className="fixed inset-0 z-[2200] flex items-center justify-center bg-[var(--overlay)] p-4 backdrop-blur-sm" onClick={onClose}>
    <div className="panel-surface w-full max-w-md rounded-[28px] p-8" onClick={(event) => event.stopPropagation()}>
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-[28px] font-semibold leading-none tracking-[-0.04em] text-[var(--text-primary)]">Keyboard Shortcuts</h2>
        <button type="button" onClick={onClose} className="text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)]">
          <X size={20} />
        </button>
      </div>
      <div className="space-y-4 text-sm text-[var(--text-secondary)]">
        <div className="flex justify-between"><span>Focus new task input</span> <kbd className="rounded bg-[var(--panel-bg)] px-2 py-0.5 text-[var(--text-primary)]">N</kbd></div>
        <div className="flex justify-between"><span>New inbox item</span> <kbd className="rounded bg-[var(--panel-bg)] px-2 py-0.5 text-[var(--text-primary)]">I</kbd></div>
        <div className="flex justify-between"><span>Planner</span> <kbd className="rounded bg-[var(--panel-bg)] px-2 py-0.5 text-[var(--text-primary)]">8</kbd></div>
        <div className="flex justify-between"><span>Search</span> <kbd className="rounded bg-[var(--panel-bg)] px-2 py-0.5 text-[var(--text-primary)]">/</kbd></div>
        <div className="flex justify-between"><span>Command palette</span> <kbd className="rounded bg-[var(--panel-bg)] px-2 py-0.5 text-[var(--text-primary)]">Ctrl/Cmd + K</kbd></div>
        <div className="flex justify-between"><span>Toggle sidebar</span> <kbd className="rounded bg-[var(--panel-bg)] px-2 py-0.5 text-[var(--text-primary)]">Ctrl/Cmd + B</kbd></div>
        <div className="flex justify-between"><span>Views</span> <kbd className="rounded bg-[var(--panel-bg)] px-2 py-0.5 text-[var(--text-primary)]">1-7</kbd></div>
        <div className="flex justify-between"><span>Cycle areas</span> <kbd className="rounded bg-[var(--panel-bg)] px-2 py-0.5 text-[var(--text-primary)]">Shift + [ ]</kbd></div>
        <div className="flex justify-between"><span>Timer pause/resume</span> <kbd className="rounded bg-[var(--panel-bg)] px-2 py-0.5 text-[var(--text-primary)]">Space</kbd></div>
        <div className="flex justify-between"><span>Timer stop</span> <kbd className="rounded bg-[var(--panel-bg)] px-2 py-0.5 text-[var(--text-primary)]">Esc</kbd></div>
        <div className="flex justify-between"><span>Timer pop-out toggle</span> <kbd className="rounded bg-[var(--panel-bg)] px-2 py-0.5 text-[var(--text-primary)]">P</kbd></div>
      </div>
    </div>
  </div>
);
