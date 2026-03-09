import { handleApiRequest, finalizeApiResponse } from '../_lib/backend';
import { Env } from '../../worker/src/types';

interface PagesContext {
  request: Request;
  env: Env;
}

export const onRequest = ({ request, env }: PagesContext): Promise<Response> => {
  return finalizeApiResponse(request, env, (requestWithId) => handleApiRequest(requestWithId, env));
};
