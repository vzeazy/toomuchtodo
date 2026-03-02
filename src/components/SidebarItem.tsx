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
  const [isOver, setIsOver] = React.useState(false);

  return (
    <div
      onClick={onClick}
      onDragOver={(event) => {
        event.preventDefault();
        setIsOver(true);
      }}
      onDragLeave={() => setIsOver(false)}
      onDrop={(event) => {
        event.preventDefault();
        setIsOver(false);
        const id = event.dataTransfer.getData('taskId');
        if (id && onDrop) onDrop(id);
      }}
      className={`group flex cursor-pointer items-center justify-between rounded-2xl px-3 py-2.5 transition-all ${active ? 'bg-[var(--accent-soft)] text-[var(--accent)] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]' : 'text-[var(--text-secondary)] hover:bg-[rgba(255,255,255,0.03)] hover:text-[var(--text-primary)]'} ${isOver ? 'border-r-2 border-[var(--accent)] bg-[var(--accent-soft)]/80' : ''} ${className}`}
      style={{ paddingLeft: `${12 + (indent * 18)}px` }}
    >
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
