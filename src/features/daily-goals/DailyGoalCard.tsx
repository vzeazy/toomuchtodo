import React from 'react';
import { motion } from 'framer-motion';
import { Archive, Check, ChevronLeft, ChevronRight, MoreHorizontal, Trash2 } from 'lucide-react';
import { DayGoal } from '../../types';

export const DailyGoalCard: React.FC<{
  goal: DayGoal;
  isPrimary: boolean;
  canMoveLeft: boolean;
  canMoveRight: boolean;
  onUpdate: (id: string, updates: Partial<DayGoal>) => void;
  onToggleComplete: (id: string) => void;
  onArchive: (id: string) => void;
  onDelete: (id: string) => void;
  onMoveLeft: (id: string) => void;
  onMoveRight: (id: string) => void;
}> = ({
  goal,
  isPrimary,
  canMoveLeft,
  canMoveRight,
  onUpdate,
  onToggleComplete,
  onArchive,
  onDelete,
  onMoveLeft,
  onMoveRight,
}) => {
  const isComplete = goal.completedAt !== null;
  const [menuOpen, setMenuOpen] = React.useState(false);
  const menuRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    if (!menuOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [menuOpen]);

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
      className={`group relative flex min-h-[72px] items-center gap-2 rounded-[22px] border px-4 py-3 ${
        isComplete
          ? 'border-[color:color-mix(in_srgb,var(--border-color)_86%,transparent)] bg-[color:color-mix(in_srgb,var(--panel-alt-bg)_78%,transparent)] opacity-75'
          : isPrimary
            ? 'border-[color:color-mix(in_srgb,var(--accent)_28%,var(--border-color))] bg-[color:color-mix(in_srgb,var(--panel-alt-bg)_72%,transparent)] shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--accent)_10%,transparent)]'
            : 'border-[color:color-mix(in_srgb,var(--border-color)_88%,transparent)] bg-[color:color-mix(in_srgb,var(--panel-alt-bg)_64%,transparent)]'
      }`}
    >
      <button
        type="button"
        onClick={() => onToggleComplete(goal.id)}
        className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-md border transition-colors ${
          isComplete
            ? 'border-[var(--success)] bg-[var(--success-soft)] text-[var(--success)]'
            : 'border-[color:color-mix(in_srgb,var(--text-secondary)_62%,var(--border-color))] bg-[color:color-mix(in_srgb,var(--panel-bg)_85%,transparent)] text-transparent hover:border-[var(--accent)]'
        }`}
        aria-label={isComplete ? 'Mark goal incomplete' : 'Mark goal complete'}
      >
        <Check size={12} strokeWidth={3} />
      </button>

      <input
        title={goal.title}
        value={goal.title}
        onChange={(event) => onUpdate(goal.id, { title: event.target.value })}
        placeholder="Untitled goal"
        className={`min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap bg-transparent text-[14px] tracking-[-0.015em] leading-5 outline-none placeholder:text-[var(--text-muted)] ${
          isComplete ? 'text-[var(--text-muted)] line-through' : isPrimary ? 'font-semibold text-[var(--text-primary)]' : 'font-medium text-[var(--text-primary)]'
        }`}
      />

      <div ref={menuRef} className="relative shrink-0">
        <button
          type="button"
          onClick={() => setMenuOpen((open) => !open)}
          className="flex h-7 w-7 items-center justify-center rounded-full text-[var(--text-muted)] opacity-75 transition-all hover:bg-[var(--panel-bg)] hover:text-[var(--text-primary)] sm:opacity-0 sm:group-hover:opacity-100"
          aria-label="Open goal actions"
        >
          <MoreHorizontal size={14} />
        </button>

        {menuOpen && (
          <div className="absolute right-0 top-9 z-20 w-[220px] rounded-[18px] border border-[var(--border-color)] bg-[color:color-mix(in_srgb,var(--panel-bg)_96%,black_4%)] p-2 shadow-[0_16px_40px_rgba(0,0,0,0.16)]">
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={!canMoveLeft}
                onClick={() => {
                  onMoveLeft(goal.id);
                  setMenuOpen(false);
                }}
                className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--text-muted)] hover:bg-[var(--panel-alt-bg)] hover:text-[var(--text-primary)] disabled:opacity-35"
                aria-label="Move goal left"
              >
                <ChevronLeft size={14} />
              </button>
              <button
                type="button"
                disabled={!canMoveRight}
                onClick={() => {
                  onMoveRight(goal.id);
                  setMenuOpen(false);
                }}
                className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--text-muted)] hover:bg-[var(--panel-alt-bg)] hover:text-[var(--text-primary)] disabled:opacity-35"
                aria-label="Move goal right"
              >
                <ChevronRight size={14} />
              </button>
              <button
                type="button"
                onClick={() => {
                  onArchive(goal.id);
                  setMenuOpen(false);
                }}
                className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--text-muted)] hover:bg-[var(--panel-alt-bg)] hover:text-[var(--text-primary)]"
                aria-label="Archive goal"
              >
                <Archive size={14} />
              </button>
              <button
                type="button"
                onClick={() => {
                  onDelete(goal.id);
                  setMenuOpen(false);
                }}
                className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--danger)] hover:bg-[var(--danger-soft)]"
                aria-label="Delete goal"
              >
                <Trash2 size={14} />
                </button>
              </div>
          </div>
        )}
      </div>
    </motion.article>
  );
};
