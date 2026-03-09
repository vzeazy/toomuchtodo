import { authRoutes } from '../../worker/src/routes/auth';
import { syncRoutes } from '../../worker/src/routes/sync';
import { REQUEST_ID_HEADER, errorJson, isAllowedOrigin, json, withRequestId } from '../../worker/src/lib';
import { Env } from '../../worker/src/types';

const withCors = (response: Response, request: Request, env: Env) => {
  const headers = new Headers(response.headers);
  headers.set(REQUEST_ID_HEADER, request.headers.get(REQUEST_ID_HEADER) || headers.get(REQUEST_ID_HEADER) || '');
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

export const handleApiRequest = async (request: Request, env: Env): Promise<Response> => {
  const { pathname } = new URL(request.url);

  if (request.method === 'OPTIONS') {
    if (!isAllowedOrigin(env, request)) {
      return json({ error: 'forbidden_origin' }, { status: 403 });
    }
    return new Response(null, { status: 204 });
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

export const finalizeApiResponse = async (request: Request, env: Env, work: (request: Request) => Promise<Response>): Promise<Response> => {
  const requestWithId = withRequestId(request);
  try {
    return withCors(await work(requestWithId), requestWithId, env);
  } catch (error) {
    return withCors(
      errorJson(requestWithId, 'internal_error', { status: 500 }, {
        message: error instanceof Error ? error.message : 'Unknown error',
        retryable: true,
      }),
      requestWithId,
      env,
    );
  }
};
