export interface Env {
  DB: D1Database;
  SESSION_SECRET: string;
  TURNSTILE_SECRET?: string;
  TURNSTILE_ENABLED?: string;
  APP_SCHEMA_LATEST?: string;
  APP_SCHEMA_MIN_SUPPORTED?: string;
  SESSION_COOKIE_NAME?: string;
}

export interface UserSession {
  sessionId: string;
  userId: string;
  email: string;
}

export interface SyncOperation {
  id: string;
  entity: 'task' | 'project' | 'settings';
  action: 'upsert' | 'delete';
  recordId: string;
  payload: Record<string, unknown>;
  deviceId: string;
  timestamp: number;
}
