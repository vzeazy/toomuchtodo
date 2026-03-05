import { Env } from './types';

export const json = (data: unknown, init: ResponseInit = {}) => {
  const headers = new Headers(init.headers);
  headers.set('content-type', 'application/json; charset=utf-8');
  headers.set('cache-control', 'no-store');
  return new Response(JSON.stringify(data), { ...init, headers });
};

export const id = (prefix: string) => `${prefix}_${crypto.randomUUID().replace(/-/g, '')}`;

const textEncoder = new TextEncoder();

const toHex = (bytes: ArrayBuffer): string => {
  const view = new Uint8Array(bytes);
  let out = '';
  for (const b of view) out += b.toString(16).padStart(2, '0');
  return out;
};

export const hash = async (value: string) => {
  const digest = await crypto.subtle.digest('SHA-256', textEncoder.encode(value));
  return toHex(digest);
};

export const hashPassword = async (password: string, salt: string, secret: string) => {
  return hash(`${secret}:${salt}:${password}`);
};

export const parseJson = async <T>(request: Request): Promise<T | null> => {
  try {
    return (await request.json()) as T;
  } catch {
    return null;
  }
};

export const readCookie = (request: Request, name: string): string | null => {
  const cookie = request.headers.get('cookie') || '';
  const chunks = cookie.split(';').map((part) => part.trim());
  for (const chunk of chunks) {
    const [k, ...rest] = chunk.split('=');
    if (k === name) return decodeURIComponent(rest.join('='));
  }
  return null;
};

export const buildSessionCookie = (env: Env, token: string, maxAgeSeconds = 60 * 60 * 24 * 30) => {
  const name = env.SESSION_COOKIE_NAME || 'tmtd_session';
  return `${name}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAgeSeconds}`;
};

export const clearSessionCookie = (env: Env) => {
  const name = env.SESSION_COOKIE_NAME || 'tmtd_session';
  return `${name}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
};

export const now = () => Date.now();

export const isMutation = (method: string) => method === 'POST' || method === 'PUT' || method === 'PATCH' || method === 'DELETE';

export const assertSameOrigin = (request: Request) => {
  const origin = request.headers.get('origin');
  if (!origin) return true;
  try {
    const originHost = new URL(origin).host;
    const requestHost = new URL(request.url).host;
    return originHost === requestHost;
  } catch {
    return false;
  }
};

const rateMap = new Map<string, { count: number; resetAt: number }>();

export const rateLimit = (key: string, max: number, windowMs: number) => {
  const nowTs = now();
  const found = rateMap.get(key);
  if (!found || found.resetAt <= nowTs) {
    rateMap.set(key, { count: 1, resetAt: nowTs + windowMs });
    return true;
  }
  if (found.count >= max) return false;
  found.count += 1;
  rateMap.set(key, found);
  return true;
};

export const verifyTurnstile = async (env: Env, token?: string | null): Promise<boolean> => {
  if ((env.TURNSTILE_ENABLED || 'false').toLowerCase() !== 'true') return true;
  if (!env.TURNSTILE_SECRET || !token) return false;
  const body = new URLSearchParams();
  body.set('secret', env.TURNSTILE_SECRET);
  body.set('response', token);

  const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    body,
  });
  if (!response.ok) return false;
  const parsed = await response.json<{ success?: boolean }>();
  return Boolean(parsed.success);
};
