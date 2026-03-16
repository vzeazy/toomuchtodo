import { Env } from '../types';

export const getSchemaMeta = async (env: Env) => {
  const row = await env.DB.prepare('SELECT latest_schema as latestSchema, min_supported_client_schema as minSupportedClientSchema FROM schema_meta WHERE id = 1').first<{ latestSchema: number; minSupportedClientSchema: number }>();
  const latestFromEnv = Number.parseInt(env.APP_SCHEMA_LATEST || '4', 10);
  const minFromEnv = Number.parseInt(env.APP_SCHEMA_MIN_SUPPORTED || '4', 10);
  return {
    latestSchema: row?.latestSchema || latestFromEnv,
    minSupportedClientSchema: row?.minSupportedClientSchema || minFromEnv,
  };
};
