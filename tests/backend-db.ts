import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';
import type { SqlDatabase, SqlResult, SqlStatement, SqlValue } from '../server/types.ts';

/** Execute the production migrations and SQL in real SQLite, with D1's atomic batch semantics. */
export class TestDatabase implements SqlDatabase {
  native: DatabaseSync;
  beforeBatch?: () => void;
  constructor() {
    this.native = new DatabaseSync(':memory:');
    this.native.exec('PRAGMA foreign_keys=ON');
    const directory = new URL('../drizzle/', import.meta.url);
    for (const file of readdirSync(directory).filter(name => name.endsWith('.sql')).sort()) this.native.exec(readFileSync(new URL(file, directory), 'utf8'));
  }
  prepare(sql: string): SqlStatement { return new TestStatement(this.native, sql); }
  async batch<T = Record<string, unknown>>(statements: SqlStatement[]): Promise<SqlResult<T>[]> {
    this.beforeBatch?.();
    this.native.exec('BEGIN IMMEDIATE');
    try {
      const results = statements.map(statement => (statement as TestStatement).execute<T>());
      this.native.exec('COMMIT'); return results;
    } catch (error) { this.native.exec('ROLLBACK'); throw error; }
  }
  close() { this.native.close(); }
}

class TestStatement implements SqlStatement {
  native: DatabaseSync; sql: string; bindings: SqlValue[] = [];
  constructor(native: DatabaseSync, sql: string) { this.native = native; this.sql = sql; }
  bind(...values: SqlValue[]): SqlStatement { this.bindings = values; return this; }
  execute<T>(): SqlResult<T> {
    const results = this.native.prepare(this.sql).all(...this.bindings) as T[];
    const changes = this.native.prepare('SELECT changes() AS count').get() as { count: number };
    return { results, success: true, meta: { changes: Number(changes.count) } };
  }
  async first<T = Record<string, unknown>>(columnName?: string): Promise<T | null> {
    const row = this.native.prepare(this.sql).get(...this.bindings) as Record<string, unknown> | undefined;
    return row ? (columnName ? row[columnName] as T : row as T) : null;
  }
  async all<T = Record<string, unknown>>(): Promise<SqlResult<T>> { return this.execute<T>(); }
  async run<T = Record<string, unknown>>(): Promise<SqlResult<T>> { return this.execute<T>(); }
}
