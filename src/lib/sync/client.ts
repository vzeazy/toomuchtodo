import { AppStateData, SyncMeta, SyncOperation } from '../../types';

export interface SyncBootstrapResponse {
  serverTime: number;
  cursor: string;
  snapshot: Pick<AppStateData, 'tasks' | 'projects' | 'settings'>;
  schema: {
    minSupportedClientSchema: number;
    latestSchema: number;
  };
}

export interface SyncPushResponse {
  accepted: number;
  conflicts: number;
  cursor: string;
}

export interface SyncPullResponse {
  cursor: string;
  changes: SyncOperation[];
  stats: {
    conflicts: number;
  };
  schema: {
    minSupportedClientSchema: number;
    latestSchema: number;
  };
}

const withBase = (path: string) => {
  const base = (import.meta.env.VITE_API_BASE_URL || '').trim();
  return `${base}${path}`;
};

export const syncApi = {
  async bootstrap() {
    const response = await fetch(withBase('/api/sync/bootstrap'), { credentials: 'include' });
    if (!response.ok) throw new Error(`bootstrap failed (${response.status})`);
    return response.json() as Promise<SyncBootstrapResponse>;
  },
  async push(meta: SyncMeta, ops: SyncOperation[]) {
    const response = await fetch(withBase('/api/sync/push'), {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        deviceId: meta.deviceId,
        cursor: meta.syncCursor,
        ops,
      }),
    });
    if (!response.ok) throw new Error(`push failed (${response.status})`);
    return response.json() as Promise<SyncPushResponse>;
  },
  async pull(meta: SyncMeta) {
    const params = new URLSearchParams();
    if (meta.syncCursor) params.set('cursor', meta.syncCursor);
    const response = await fetch(withBase(`/api/sync/pull?${params.toString()}`), { credentials: 'include' });
    if (!response.ok) throw new Error(`pull failed (${response.status})`);
    return response.json() as Promise<SyncPullResponse>;
  },
};
