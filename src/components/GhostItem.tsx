import React, { useState } from 'react';
import { Plus } from 'lucide-react';

export const GhostItem: React.FC<{
  placeholder: string;
  onAdd: (title: string, indentMode?: 'indent' | 'none') => void;
  className?: string;
  iconSize?: number;
  inputRef?: (element: HTMLInputElement | null) => void;
  onArrowNavigate?: (direction: 'up' | 'down') => void;
}> = ({ placeholder, onAdd, className = '', iconSize = 14, inputRef, onArrowNavigate }) => {
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
        className={`w-full border-none bg-transparent text-[13px] outline-none transition-all placeholder:font-normal ${isFocused ? 'text-[var(--text-primary)] placeholder:text-[var(--text-muted)]' : 'cursor-pointer text-[var(--text-primary)]/90 placeholder:text-[var(--text-muted)]'}`}
      />
    </div>
  );
};
