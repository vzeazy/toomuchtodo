import { Env, UserSession } from '../types';
import {
  buildSessionCookie,
  clearSessionCookie,
  hash,
  hashPassword,
  id,
  isAllowedOrigin,
  json,
  now,
  parseJson,
  rateLimit,
  readCookie,
  verifyTurnstile,
} from '../lib';

interface AuthPayload {
  email?: string;
  password?: string;
  turnstileToken?: string;
}

interface AuthUser {
  id: string;
  email: string;
  createdAt: number;
}

const getSessionFromRequest = async (env: Env, request: Request): Promise<UserSession | null> => {
  const cookieName = env.SESSION_COOKIE_NAME || 'tmtd_session';
  const token = readCookie(request, cookieName);
  if (!token) return null;
  const tokenHash = await hash(token);

  const row = await env.DB.prepare(
    `SELECT s.id as sessionId, s.user_id as userId, u.email as email, u.created_at as createdAt
     FROM sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = ? AND s.expires_at > ?`,
  )
    .bind(tokenHash, now())
    .first<{ sessionId: string; userId: string; email: string; createdAt: number }>();

  if (!row) return null;

  await env.DB.prepare('UPDATE sessions SET expires_at = ? WHERE id = ?')
    .bind(now() + (60 * 60 * 24 * 30 * 1000), row.sessionId)
    .run();

  return row;
};

const createSessionResponse = async (
  env: Env,
  user: AuthUser,
  options: { ip?: string; recordSignInAudit?: boolean } = {},
) => {
  const token = `${crypto.randomUUID()}.${crypto.randomUUID()}`;
  const tokenHash = await hash(token);
  const sessionId = id('sess');
  const ts = now();

  const statements = [
    env.DB.prepare('INSERT INTO sessions (id, user_id, token_hash, created_at, expires_at) VALUES (?, ?, ?, ?, ?)')
      .bind(sessionId, user.id, tokenHash, ts, ts + (60 * 60 * 24 * 30 * 1000)),
  ];

  if (options.recordSignInAudit) {
    statements.push(
      env.DB.prepare('INSERT INTO audit_events (id, user_id, event_type, payload, created_at) VALUES (?, ?, ?, ?, ?)')
        .bind(id('audit'), user.id, 'sign_in', JSON.stringify({ ip: options.ip || 'unknown' }), ts),
    );
  }

  await env.DB.batch(statements);

  return json(
    { user: { id: user.id, email: user.email, createdAt: user.createdAt } },
    { headers: { 'set-cookie': buildSessionCookie(env, token) } },
  );
};

const requireSession = async (env: Env, request: Request) => {
  const session = await getSessionFromRequest(env, request);
  if (!session) return { session: null, response: json({ error: 'unauthorized' }, { status: 401 }) };
  return { session, response: null };
};

const parseCreds = (payload: AuthPayload | null) => {
  const email = (payload?.email || '').trim().toLowerCase();
  const password = payload?.password || '';
  return { email, password };
};

export const authRoutes = {
  async signUp(env: Env, request: Request) {
    if (!isAllowedOrigin(env, request)) return json({ error: 'forbidden_origin' }, { status: 403 });

    const ip = request.headers.get('cf-connecting-ip') || 'unknown';
    if (!rateLimit(`sign-up:${ip}`, 15, 60_000)) return json({ error: 'rate_limited' }, { status: 429 });

    const payload = await parseJson<AuthPayload>(request);
    const { email, password } = parseCreds(payload);

    if (!email || password.length < 8) {
      return json({ error: 'invalid_credentials' }, { status: 400 });
    }

    const turnstileOk = await verifyTurnstile(env, payload?.turnstileToken || null);
    if (!turnstileOk) return json({ error: 'turnstile_failed' }, { status: 400 });

    const existing = await env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(email).first<{ id: string }>();
    if (existing) return json({ error: 'email_exists' }, { status: 409 });

    const userId = id('usr');
    const salt = id('salt');
    const passwordHash = await hashPassword(password, salt, env.SESSION_SECRET);
    const ts = now();

    await env.DB.batch([
      env.DB.prepare('INSERT INTO users (id, email, password_hash, salt, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
        .bind(userId, email, passwordHash, salt, ts, ts),
      env.DB.prepare('INSERT INTO audit_events (id, user_id, event_type, payload, created_at) VALUES (?, ?, ?, ?, ?)')
        .bind(id('audit'), userId, 'sign_up', JSON.stringify({ email }), ts),
    ]);

    return createSessionResponse(env, { id: userId, email, createdAt: ts });
  },

  async signIn(env: Env, request: Request) {
    if (!isAllowedOrigin(env, request)) return json({ error: 'forbidden_origin' }, { status: 403 });

    const ip = request.headers.get('cf-connecting-ip') || 'unknown';
    if (!rateLimit(`sign-in:${ip}`, 30, 60_000)) return json({ error: 'rate_limited' }, { status: 429 });

    const payload = await parseJson<AuthPayload>(request);
    const { email, password } = parseCreds(payload);

    if (!email || !password) {
      return json({ error: 'invalid_credentials' }, { status: 400 });
    }

    const turnstileOk = await verifyTurnstile(env, payload?.turnstileToken || null);
    if (!turnstileOk) return json({ error: 'turnstile_failed' }, { status: 400 });

    const row = await env.DB.prepare('SELECT id, email, password_hash as passwordHash, salt, created_at as createdAt FROM users WHERE email = ?')
      .bind(email)
      .first<{ id: string; email: string; passwordHash: string; salt: string; createdAt: number }>();

    if (!row) return json({ error: 'invalid_credentials' }, { status: 401 });

    const passwordHash = await hashPassword(password, row.salt, env.SESSION_SECRET);
    if (passwordHash !== row.passwordHash) return json({ error: 'invalid_credentials' }, { status: 401 });

    return createSessionResponse(env, { id: row.id, email: row.email, createdAt: row.createdAt }, { ip, recordSignInAudit: true });
  },

  async signOut(env: Env, request: Request) {
    if (!isAllowedOrigin(env, request)) return json({ error: 'forbidden_origin' }, { status: 403 });

    const cookieName = env.SESSION_COOKIE_NAME || 'tmtd_session';
    const token = readCookie(request, cookieName);

    if (token) {
      const tokenHash = await hash(token);
      await env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(tokenHash).run();
    }

    return json({ ok: true }, { headers: { 'set-cookie': clearSessionCookie(env) } });
  },

  async session(env: Env, request: Request) {
    const session = await getSessionFromRequest(env, request);
    if (!session) return json({ error: 'unauthorized' }, { status: 401 });
    return json({ user: { id: session.userId, email: session.email, createdAt: session.createdAt } });
  },

  requireSession,
};
