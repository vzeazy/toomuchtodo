import React from 'react';

export const SidebarItem: React.FC<{
  icon: React.ComponentType<{ size?: number; className?: string; style?: React.CSSProperties }>;
  label: string;
  count?: number;
  active: boolean;
  onClick: (event: React.MouseEvent) => void;
  onDrop?: (id: string) => void;
  className?: string;
  iconColor?: string;
  indent?: number;
  actions?: React.ReactNode;
}> = ({ icon: Icon, label, count, active, onClick, onDrop, className = '', iconColor, indent = 0, actions }) => {
  // HTML5 drag API lowercases all type keys in dataTransfer.types
  const hasTaskDragPayload = (dataTransfer: DataTransfer) => Array.from(dataTransfer.types || []).includes('taskid');
  const [isOver, setIsOver] = React.useState(false);

  return (
    <div
      onClick={onClick}
      onDragOver={(event) => {
        if (!hasTaskDragPayload(event.dataTransfer)) return;
        event.preventDefault();
        setIsOver(true);
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node)) {
          setIsOver(false);
        }
      }}
      onDrop={(event) => {
        if (!hasTaskDragPayload(event.dataTransfer)) return;
        event.preventDefault();
        setIsOver(false);
        const id = event.dataTransfer.getData('taskId');
        if (id && onDrop) onDrop(id);
      }}
      className={`group relative flex cursor-pointer items-center justify-between rounded-2xl px-3 py-2.5 transition-all ${active ? 'bg-[var(--accent-soft)] text-[var(--accent)] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]' : 'text-[var(--text-secondary)] hover:bg-[rgba(255,255,255,0.03)] hover:text-[var(--text-primary)]'} ${isOver ? 'bg-[var(--accent-soft)]/90 ring-1 ring-[var(--accent)]/65 shadow-[0_0_0_1px_var(--accent-soft)]' : ''} ${className}`}
      style={{ paddingLeft: `${12 + (indent * 18)}px` }}
    >
      {isOver && (
        <span className="pointer-events-none absolute right-2 top-1 rounded-full bg-[var(--accent-soft)] px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] text-[var(--accent)]">
          Move here
        </span>
      )}
      <div className="flex min-w-0 items-center gap-3">
        <Icon size={16} className={active ? 'text-[var(--accent)]' : 'text-[var(--text-muted)]'} style={iconColor ? { color: iconColor } : undefined} />
        <span className="truncate text-[13px] font-semibold tracking-[-0.01em]">{label}</span>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {actions}
        {count !== undefined && count > 0 && <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${active ? 'bg-[rgba(255,255,255,0.08)] text-[var(--accent)]' : 'bg-[rgba(255,255,255,0.04)] text-[var(--text-muted)]'}`}>{count}</span>}
      </div>
    </div>
  );
};
