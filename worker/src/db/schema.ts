import { Env } from '../types';

interface OptionalSyncTableDefinition {
  name: string;
  schemaVersion: number;
  createTableSql: string;
  createIndexSql: string[];
}

const OPTIONAL_SYNC_TABLES: OptionalSyncTableDefinition[] = [
  {
    name: 'day_goals',
    schemaVersion: 4,
    createTableSql: `CREATE TABLE IF NOT EXISTS day_goals (
      id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      date TEXT NOT NULL,
      title TEXT NOT NULL,
      linked_task_id TEXT,
      position INTEGER NOT NULL DEFAULT 0,
      completed_at INTEGER,
      archived_at INTEGER,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      deleted_at INTEGER,
      version INTEGER NOT NULL DEFAULT 1,
      PRIMARY KEY (user_id, id)
    );`,
    createIndexSql: [
      'CREATE INDEX IF NOT EXISTS idx_day_goals_user_date ON day_goals(user_id, date, position);',
      'CREATE INDEX IF NOT EXISTS idx_day_goals_user_deleted ON day_goals(user_id, deleted_at);',
      'CREATE INDEX IF NOT EXISTS idx_day_goals_user_updated ON day_goals(user_id, updated_at);',
    ],
  },
];

const runtimeSchemaByDatabase = new WeakMap<object, Promise<void>>();

const ensureOptionalSyncTables = async (env: Env) => {
  if (!OPTIONAL_SYNC_TABLES.length) return;

  const placeholders = OPTIONAL_SYNC_TABLES.map(() => '?').join(', ');
  const existingRows = await env.DB.prepare(
    `SELECT name FROM sqlite_master WHERE type = 'table' AND name IN (${placeholders})`,
  )
    .bind(...OPTIONAL_SYNC_TABLES.map((definition) => definition.name))
    .all<{ name: string }>();
  const existingTables = new Set((existingRows.results || []).map((row) => String(row.name)));

  const statements: string[] = [];
  const missingDefinitions: OptionalSyncTableDefinition[] = [];

  for (const definition of OPTIONAL_SYNC_TABLES) {
    if (!existingTables.has(definition.name)) {
      statements.push(definition.createTableSql);
      missingDefinitions.push(definition);
    }
  }

  for (const definition of OPTIONAL_SYNC_TABLES) {
    statements.push(...definition.createIndexSql);
  }

  if (statements.length) {
    await env.DB.batch(statements.map((statement) => env.DB.prepare(statement)));
  }

  if (missingDefinitions.length) {
    const latestOptionalSchema = Math.max(...missingDefinitions.map((definition) => definition.schemaVersion));
    await env.DB.prepare(
      'UPDATE schema_meta SET latest_schema = MAX(latest_schema, ?), updated_at = unixepoch() * 1000 WHERE id = 1',
    )
      .bind(latestOptionalSchema)
      .run();
  }
};

export const getSchemaMeta = async (env: Env) => {
  const row = await env.DB.prepare('SELECT latest_schema as latestSchema, min_supported_client_schema as minSupportedClientSchema FROM schema_meta WHERE id = 1').first<{ latestSchema: number; minSupportedClientSchema: number }>();
  const latestFromEnv = Number.parseInt(env.APP_SCHEMA_LATEST || '4', 10);
  const minFromEnv = Number.parseInt(env.APP_SCHEMA_MIN_SUPPORTED || '4', 10);
  return {
    latestSchema: row?.latestSchema || latestFromEnv,
    minSupportedClientSchema: row?.minSupportedClientSchema || minFromEnv,
  };
};

export const ensureSyncEntityStorage = async (env: Env) => {
  const databaseKey = env.DB as unknown as object;
  let existing = runtimeSchemaByDatabase.get(databaseKey);

  if (!existing) {
    existing = ensureOptionalSyncTables(env).catch((error) => {
      runtimeSchemaByDatabase.delete(databaseKey);
      throw error;
    });
    runtimeSchemaByDatabase.set(databaseKey, existing);
  }

  await existing;
};
