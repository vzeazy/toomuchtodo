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

const normalizeSameSite = (value?: string | null) => {
  const normalized = (value || 'Lax').trim().toLowerCase();
  if (normalized === 'none') return 'None';
  if (normalized === 'strict') return 'Strict';
  return 'Lax';
};

const getCookieAttrs = (env: Env, maxAgeSeconds: number) => {
  const attrs = [
    'Path=/',
    'HttpOnly',
    'Secure',
    `SameSite=${normalizeSameSite(env.SESSION_COOKIE_SAME_SITE)}`,
    `Max-Age=${maxAgeSeconds}`,
  ];
  const domain = (env.SESSION_COOKIE_DOMAIN || '').trim();
  if (domain) attrs.push(`Domain=${domain}`);
  return attrs.join('; ');
};

export const buildSessionCookie = (env: Env, token: string, maxAgeSeconds = 60 * 60 * 24 * 30) => {
  const name = env.SESSION_COOKIE_NAME || 'tmtd_session';
  return `${name}=${encodeURIComponent(token)}; ${getCookieAttrs(env, maxAgeSeconds)}`;
};

export const clearSessionCookie = (env: Env) => {
  const name = env.SESSION_COOKIE_NAME || 'tmtd_session';
  return `${name}=; ${getCookieAttrs(env, 0)}`;
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

export const getAllowedOrigins = (env: Env) => {
  return (env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
};

export const isAllowedOrigin = (env: Env, request: Request) => {
  const origin = request.headers.get('origin');
  if (!origin) return true;

  const allowedOrigins = getAllowedOrigins(env);
  if (allowedOrigins.length > 0) {
    return allowedOrigins.includes(origin);
  }

  return assertSameOrigin(request);
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
