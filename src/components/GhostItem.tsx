import React, { useState } from 'react';
import { Plus } from 'lucide-react';

export const GhostItem: React.FC<{
  placeholder: string;
  onAdd: (title: string, indentMode?: 'indent' | 'none') => void;
  className?: string;
  iconSize?: number;
  textSizeClass?: string;
  inputRef?: (element: HTMLInputElement | null) => void;
  onArrowNavigate?: (direction: 'up' | 'down') => void;
}> = ({ placeholder, onAdd, className = '', iconSize = 14, textSizeClass = 'text-[13px]', inputRef, onArrowNavigate }) => {
  const [value, setValue] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [indentMode, setIndentMode] = useState<'indent' | 'none'>('none');

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Tab') {
      event.preventDefault();
      setIndentMode(event.shiftKey ? 'none' : 'indent');
    }
    if (event.key === 'Enter' && value.trim()) {
      onAdd(value.trim(), indentMode);
      setValue('');
    }
    if ((event.key === 'ArrowUp' || event.key === 'ArrowDown') && onArrowNavigate) {
      event.preventDefault();
      onArrowNavigate(event.key === 'ArrowUp' ? 'up' : 'down');
    }
  };

  const showTabHint = isFocused && value.trim().length > 0 && indentMode === 'none';

  return (
    <div className={`group/ghost flex items-center gap-2 rounded px-2 py-1.5 transition-all ${isFocused ? 'bg-[rgba(255,255,255,0.03)]' : 'hover:bg-[rgba(255,255,255,0.02)]'} ${className}`} style={{ paddingLeft: indentMode === 'indent' ? '32px' : undefined }}>
      <Plus size={iconSize} className={`transition-colors ${isFocused ? 'text-[var(--accent)]' : 'text-[var(--text-muted)] group-hover/ghost:text-[var(--text-secondary)]'}`} />
      <input
        type="text"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        ref={inputRef}
        placeholder={placeholder}
        className={`min-w-0 flex-1 border-none bg-transparent p-0 font-medium tracking-[-0.01em] ${textSizeClass} outline-none transition-all placeholder:font-normal focus:ring-0 ${isFocused ? 'text-[var(--text-primary)] placeholder:text-[var(--text-muted)]' : 'cursor-pointer text-[var(--text-primary)]/90 placeholder:text-[var(--text-muted)]'}`}
      />
      {showTabHint && (
        <span className="flex shrink-0 animate-[fadeIn_0.15s_ease] items-center gap-1 text-[10px] text-[var(--text-muted)]">
          <kbd className="rounded bg-[var(--panel-bg)] px-1 py-0.5 text-[9px] font-bold text-[var(--text-muted)] shadow-[0_1px_0_1px_var(--border-color)]">Tab</kbd>
          to nest
        </span>
      )}
    </div>
  );
};
