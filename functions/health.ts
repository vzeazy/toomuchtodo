import { json } from '../worker/src/lib';
import { Env } from '../worker/src/types';

interface PagesContext {
  request: Request;
  env: Env;
}

export const onRequest = ({ request, env }: PagesContext): Promise<Response> => {
  const response = json({ ok: true, now: Date.now() });
  const origin = request.headers.get('origin');
  if (!origin) return Promise.resolve(response);

  const headers = new Headers(response.headers);
  headers.set('access-control-allow-origin', origin);
  headers.set('vary', 'origin');
  headers.set('access-control-allow-credentials', 'true');
  return Promise.resolve(new Response(response.body, { status: response.status, statusText: response.statusText, headers }));
};
