import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ChevronDown, Check } from 'lucide-react';

export interface SmartSelectOption {
    value: string;
    label: string;
}

export const SmartSelect: React.FC<{
    value: string;
    onChange: (value: string) => void;
    options: SmartSelectOption[];
    placeholder?: string;
    className?: string;
}> = ({ value, onChange, options, placeholder, className }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [query, setQuery] = useState('');
    const containerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const selectedOption = useMemo(() => options.find((o) => o.value === value), [options, value]);

    useEffect(() => {
        if (isOpen) {
            setQuery('');
            inputRef.current?.focus();
        }
    }, [isOpen]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const filteredOptions = useMemo(() => {
        const q = query.toLowerCase();
        if (!q) return options;
        return options.filter((o) => o.label.toLowerCase().includes(q));
    }, [options, query]);

    return (
        <div ref={containerRef} className="relative w-full">
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className={`flex w-full items-center justify-between text-left ${className}`}
            >
                <span className={selectedOption ? '' : 'text-[var(--text-muted)] opacity-70'}>
                    {selectedOption ? selectedOption.label : placeholder || 'Select...'}
                </span>
                <ChevronDown size={14} className="ml-2 shrink-0 opacity-50 transition-transform" style={{ transform: isOpen ? 'rotate(180deg)' : 'none' }} />
            </button>

            {isOpen && (
                <div className="absolute left-0 top-full z-[2500] mt-1 max-h-64 w-full overflow-y-auto rounded-xl border soft-divider bg-[var(--elevated-bg)] p-1.5 shadow-xl transition-all">
                    <div className="sticky top-0 z-10 mb-1.5 bg-[var(--elevated-bg)] pb-1.5">
                        <input
                            ref={inputRef}
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Search..."
                            className="w-full rounded-lg bg-[rgba(255,255,255,0.06)] px-3 py-2 text-[13px] text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)] focus:bg-[rgba(255,255,255,0.1)]"
                            onClick={(e) => e.stopPropagation()}
                        />
                    </div>

                    {filteredOptions.length === 0 && (
                        <div className="py-4 text-center text-[12px] font-medium text-[var(--text-muted)]">No matching results</div>
                    )}

                    <div className="space-y-0.5">
                        {filteredOptions.map((opt) => (
                            <button
                                key={opt.value}
                                type="button"
                                onClick={() => {
                                    onChange(opt.value);
                                    setIsOpen(false);
                                }}
                                className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-[13px] font-medium transition-colors ${value === opt.value ? 'bg-[var(--accent-soft)] text-[var(--accent)]' : 'text-[var(--text-primary)] hover:bg-[rgba(255,255,255,0.06)]'}`}
                            >
                                <span className="truncate">{opt.label}</span>
                                {value === opt.value && <Check size={14} className="text-[var(--accent)]" />}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};
