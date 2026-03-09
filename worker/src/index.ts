import { authRoutes } from './routes/auth';
import { syncRoutes } from './routes/sync';
import { Env } from './types';
import { isAllowedOrigin, json } from './lib';

const withCors = (response: Response, request: Request, env: Env) => {
  const headers = new Headers(response.headers);
  const origin = request.headers.get('origin');
  if (origin && isAllowedOrigin(env, request)) {
    headers.set('access-control-allow-origin', origin);
    headers.set('vary', 'origin');
    headers.set('access-control-allow-credentials', 'true');
    headers.set('access-control-allow-headers', 'content-type');
    headers.set('access-control-allow-methods', 'GET,POST,OPTIONS');
  }
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
};

const router = async (request: Request, env: Env): Promise<Response> => {
  const { pathname } = new URL(request.url);

  if (request.method === 'OPTIONS') {
    if (!isAllowedOrigin(env, request)) {
      return json({ error: 'forbidden_origin' }, { status: 403 });
    }
    return new Response(null, { status: 204 });
  }

  if (pathname === '/health') {
    return json({ ok: true, now: Date.now() });
  }

  if (pathname === '/api/auth/sign-up' && request.method === 'POST') {
    return authRoutes.signUp(env, request);
  }
  if (pathname === '/api/auth/sign-in' && request.method === 'POST') {
    return authRoutes.signIn(env, request);
  }
  if (pathname === '/api/auth/sign-out' && request.method === 'POST') {
    return authRoutes.signOut(env, request);
  }
  if (pathname === '/api/auth/session' && request.method === 'GET') {
    return authRoutes.session(env, request);
  }

  const guarded = await authRoutes.requireSession(env, request);
  if (!guarded.session) return guarded.response as Response;

  if (pathname === '/api/sync/bootstrap' && request.method === 'GET') {
    return syncRoutes.bootstrap(env, request, guarded.session);
  }
  if (pathname === '/api/sync/push' && request.method === 'POST') {
    return syncRoutes.push(env, request, guarded.session);
  }
  if (pathname === '/api/sync/pull' && request.method === 'GET') {
    return syncRoutes.pull(env, request, guarded.session);
  }

  return json({ error: 'not_found' }, { status: 404 });
};

const fetchHandler = (request: Request, env: Env): Promise<Response> => {
  return router(request, env)
    .then((response) => withCors(response, request, env))
    .catch((error) => withCors(
      json({ error: 'internal_error', message: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 }),
      request,
      env,
    ));
};

export default {
  fetch: fetchHandler,
};
