import React from 'react';
import { Check } from 'lucide-react';

export const TaskCheckbox: React.FC<{
  checked: boolean;
  onToggle: () => void;
  className?: string;
}> = ({ checked, onToggle, className = '' }) => (
  <button
    type="button"
    aria-pressed={checked}
    aria-label={checked ? 'Mark task incomplete' : 'Mark task complete'}
    onClick={(event) => {
      event.stopPropagation();
      onToggle();
    }}
    className={`flex h-5 w-5 items-center justify-center rounded-md border transition-all ${checked ? 'border-[var(--success)] bg-[var(--success-soft)] text-[var(--success)] shadow-[0_0_0_1px_var(--success-soft)]' : 'border-[var(--border-color)] bg-[var(--panel-alt-bg)] text-transparent hover:border-[var(--focus)] hover:bg-[var(--elevated-bg)]'} ${className}`}
  >
    <Check size={13} strokeWidth={3} />
  </button>
);
