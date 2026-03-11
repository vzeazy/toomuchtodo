import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

type SqlValue = string | number | null | Uint8Array;

class TestD1Statement {
  constructor(
    private readonly db: DatabaseSync,
    private readonly sql: string,
    private readonly values: SqlValue[] = [],
  ) {}

  bind(...values: SqlValue[]) {
    return new TestD1Statement(this.db, this.sql, values);
  }

  async first<T>() {
    const statement = this.db.prepare(this.sql);
    const row = statement.get(...this.values) as T | undefined;
    return row ?? null;
  }

  async all<T>() {
    const statement = this.db.prepare(this.sql);
    const results = statement.all(...this.values) as T[];
    return { results };
  }

  async run() {
    const statement = this.db.prepare(this.sql);
    const result = statement.run(...this.values);
    return {
      success: true,
      meta: {
        changes: Number(result.changes ?? 0),
        last_row_id: Number(result.lastInsertRowid ?? 0),
      },
    };
  }

  async execute() {
    if (/^\s*select\b/i.test(this.sql)) {
      const statement = this.db.prepare(this.sql);
      const results = statement.all(...this.values);
      return {
        success: true,
        results,
        meta: {
          changes: 0,
          last_row_id: 0,
        },
      };
    }

    return this.run();
  }
}

export class TestD1Database {
  private readonly db = new DatabaseSync(':memory:');

  constructor() {
    this.db.exec('PRAGMA foreign_keys = ON;');
  }

  prepare(sql: string) {
    return new TestD1Statement(this.db, sql);
  }

  async batch(statements: Array<{ execute?: () => Promise<unknown>; run: () => Promise<unknown> }>) {
    this.db.exec('BEGIN');
    try {
      const results = [];
      for (const statement of statements) {
        results.push(await (statement.execute ? statement.execute() : statement.run()));
      }
      this.db.exec('COMMIT');
      return results;
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }

  exec(sql: string) {
    this.db.exec(sql);
  }

  close() {
    this.db.close();
  }
}

export const applyMigrations = (db: TestD1Database) => {
  const migrationsDir = join(process.cwd(), 'worker', 'migrations');
  const files = readdirSync(migrationsDir)
    .filter((file) => file.endsWith('.sql'))
    .sort();

  for (const file of files) {
    db.exec(readFileSync(join(migrationsDir, file), 'utf8'));
  }
};
