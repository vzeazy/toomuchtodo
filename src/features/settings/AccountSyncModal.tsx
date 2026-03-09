import React from 'react';
import { X } from 'lucide-react';
import { AccountSyncPanel, AccountSyncPanelProps } from './AccountSyncPanel';

export const AccountSyncModal: React.FC<AccountSyncPanelProps & { onClose: () => void }> = ({ onClose, ...props }) => (
  <div
    className="fixed inset-0 z-[2200] flex items-center justify-center bg-[var(--overlay)] p-4 backdrop-blur-sm"
    onClick={onClose}
  >
    <div
      className="panel-surface w-full max-w-2xl rounded-[28px] p-6"
      onClick={(event) => event.stopPropagation()}
    >
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-[28px] font-semibold leading-none tracking-[-0.04em] text-[var(--text-primary)]">
          Account & Sync
        </h2>
        <button
          type="button"
          onClick={onClose}
          className="text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)]"
        >
          <X size={20} />
        </button>
      </div>

      <AccountSyncPanel {...props} variant="modal" />
    </div>
  </div>
);
