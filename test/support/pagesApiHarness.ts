import { onRequest } from '../../functions/api/[[route]].ts';
import type { Env } from '../../worker/src/types';
import { applyMigrations, TestD1Database } from './d1';

interface RequestOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: unknown;
}

const buildEnv = (db: TestD1Database, overrides: Partial<Env> = {}): Env => ({
  DB: db as unknown as D1Database,
  SESSION_SECRET: 'test-session-secret',
  TURNSTILE_SECRET: 'test-turnstile-secret',
  TURNSTILE_ENABLED: 'false',
  APP_SCHEMA_LATEST: '2',
  APP_SCHEMA_MIN_SUPPORTED: '2',
  SESSION_COOKIE_NAME: 'tmtd_session',
  SESSION_COOKIE_SAME_SITE: 'Lax',
  ALLOWED_ORIGINS: 'https://do.webme.ca',
  ...overrides,
});

export class TestClient {
  private cookieHeader = '';

  constructor(
    private readonly env: Env,
    private readonly ipAddress: string,
  ) {}

  async request(path: string, options: RequestOptions = {}) {
    const headers = new Headers(options.headers);
    headers.set('cf-connecting-ip', this.ipAddress);
    if (this.cookieHeader) headers.set('cookie', this.cookieHeader);

    let body: BodyInit | undefined;
    if (options.body !== undefined) {
      headers.set('content-type', 'application/json');
      body = JSON.stringify(options.body);
    }

    const response = await onRequest({
      request: new Request(`https://do.webme.ca${path}`, {
        method: options.method || (body ? 'POST' : 'GET'),
        headers,
        body,
      }),
      env: this.env,
    });

    const setCookie = response.headers.get('set-cookie');
    if (setCookie) {
      this.cookieHeader = setCookie.split(';', 1)[0] || '';
    }

    return response;
  }

  async requestJson<T>(path: string, options: RequestOptions = {}) {
    const response = await this.request(path, options);
    const data = await response.json() as T;
    return { response, data };
  }
}

export const createPagesApiHarness = (overrides: Partial<Env> = {}) => {
  const db = new TestD1Database();
  applyMigrations(db);
  const env = buildEnv(db, overrides);
  let clientCount = 0;

  return {
    env,
    createClient() {
      clientCount += 1;
      return new TestClient(env, `203.0.113.${clientCount}`);
    },
    close() {
      db.close();
    },
  };
};
