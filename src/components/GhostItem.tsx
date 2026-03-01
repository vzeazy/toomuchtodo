import React, { useState } from 'react';
import { Plus } from 'lucide-react';

export const GhostItem: React.FC<{
  placeholder: string;
  onAdd: (title: string) => void;
  className?: string;
  iconSize?: number;
}> = ({ placeholder, onAdd, className = '', iconSize = 14 }) => {
  const [value, setValue] = useState('');
  const [isFocused, setIsFocused] = useState(false);

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && value.trim()) {
      onAdd(value.trim());
      setValue('');
    }
  };

  return (
    <div className={`group/ghost flex items-center gap-2 rounded px-2 py-1.5 transition-all ${isFocused ? 'bg-[rgba(255,255,255,0.03)]' : 'hover:bg-[rgba(255,255,255,0.02)]'} ${className}`}>
      <Plus size={iconSize} className={`transition-colors ${isFocused ? 'text-[var(--accent)]' : 'text-[var(--text-muted)] group-hover/ghost:text-[var(--text-secondary)]'}`} />
      <input
        type="text"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        placeholder={placeholder}
        className={`w-full border-none bg-transparent text-[13px] outline-none transition-all placeholder:font-normal ${isFocused ? 'text-[var(--text-primary)] placeholder:text-[var(--text-muted)]' : 'cursor-pointer text-[var(--text-secondary)] placeholder:text-[var(--text-muted)]/70'}`}
      />
    </div>
  );
};
