import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Plus, Sparkles } from 'lucide-react';
import { DayGoal } from '../../types';
import { isDailyGoalsEnabledForSurface } from './dailyGoalsRegistry';
import { DailyGoalCard } from './DailyGoalCard';
import { hasOpenGoalSlots } from './dayGoalsSelectors';

const MAX_ACTIVE_GOALS = 3;

export const DailyGoalsSection: React.FC<{
  enabled: boolean;
  dateStr: string;
  goals: DayGoal[];
  onAddGoal: (input: { date: string; title?: string; linkedTaskId?: string | null }) => void;
  onUpdateGoal: (id: string, updates: Partial<DayGoal>) => void;
  onToggleGoalComplete: (id: string) => void;
  onArchiveGoal: (id: string) => void;
  onDeleteGoal: (id: string) => void;
  onReorderGoals: (date: string, sourceId: string, targetId: string) => void;
}> = ({
  enabled,
  dateStr,
  goals,
  onAddGoal,
  onUpdateGoal,
  onToggleGoalComplete,
  onArchiveGoal,
  onDeleteGoal,
  onReorderGoals,
}) => {
  const [draftTitle, setDraftTitle] = React.useState('');

  if (!isDailyGoalsEnabledForSurface(enabled, 'day-panel')) {
    return null;
  }

  const activeGoals = goals.filter((goal) => goal.archivedAt === null);
  const canAddGoal = hasOpenGoalSlots(activeGoals, MAX_ACTIVE_GOALS);
  const commitDraft = () => {
    const title = draftTitle.trim();
    if (!title || !canAddGoal) return;
    onAddGoal({ date: dateStr, title });
    setDraftTitle('');
  };

  return (
    <section className="mx-auto mb-5 max-w-5xl px-[2px]">
      <div className="section-kicker mb-2 flex items-center gap-2 text-[10px] font-bold uppercase text-[var(--accent)]">
        <Sparkles size={12} />
        Daily Focus
      </div>
      <motion.div layout className="grid gap-3 md:grid-cols-3">
        <AnimatePresence initial={false}>
          {activeGoals.map((goal, index) => (
            <DailyGoalCard
              key={goal.id}
              goal={goal}
              isPrimary={index === 0}
              canMoveLeft={index > 0}
              canMoveRight={index < activeGoals.length - 1}
              onUpdate={onUpdateGoal}
              onToggleComplete={onToggleGoalComplete}
              onArchive={onArchiveGoal}
              onDelete={onDeleteGoal}
              onMoveLeft={(id) => onReorderGoals(dateStr, id, activeGoals[index - 1].id)}
              onMoveRight={(id) => onReorderGoals(dateStr, id, activeGoals[index + 1].id)}
            />
          ))}
        </AnimatePresence>

        {canAddGoal && (
          <motion.div
            layout
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="flex min-h-[72px] items-center rounded-[22px] border border-dashed soft-divider bg-[color:color-mix(in_srgb,var(--panel-alt-bg)_42%,transparent)] px-4 py-3"
          >
            <div className="flex w-full items-center gap-2">
              <Plus size={12} className="shrink-0 text-[var(--text-muted)]" />
              <input
                value={draftTitle}
                onChange={(event) => setDraftTitle(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key !== 'Enter') return;
                  event.preventDefault();
                  commitDraft();
                }}
                onBlur={() => {
                  if (draftTitle.trim()) commitDraft();
                }}
                placeholder="Add goal"
                className="w-full bg-transparent text-[13px] text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)]"
              />
            </div>
          </motion.div>
        )}
      </motion.div>
    </section>
  );
};
