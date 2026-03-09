import { AppStateData, SyncConflict, SyncMeta, SyncOperation } from '../../types';
import { ApiResponse, requestJson } from './http';

export interface SyncBootstrapResponse {
  serverTime: number;
  cursor: string;
  snapshot: Pick<AppStateData, 'tasks' | 'projects' | 'settings'>;
  settingsVersion: number | null;
  schema: {
    minSupportedClientSchema: number;
    latestSchema: number;
  };
}

export interface SyncPushResponse {
  accepted: number;
  acceptedOpIds: string[];
  conflicts: SyncConflict[];
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

export const syncApi = {
  async bootstrap() {
    return requestJson<SyncBootstrapResponse>('bootstrap', '/api/sync/bootstrap');
  },
  async push(meta: SyncMeta, ops: SyncOperation[]) {
    return requestJson<SyncPushResponse>('push', '/api/sync/push', {
      body: {
        deviceId: meta.deviceId,
        cursor: meta.syncCursor,
        ops,
      },
      retries: 2,
    });
  },
  async pull(meta: SyncMeta) {
    const params = new URLSearchParams();
    if (meta.syncCursor) params.set('cursor', meta.syncCursor);
    return requestJson<SyncPullResponse>('pull', `/api/sync/pull?${params.toString()}`, { retries: 2 });
  },
};

export type SyncApiResult<T> = ApiResponse<T>;
