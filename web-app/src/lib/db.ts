import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';

let dbInstance: DatabaseSync | null = null;

export function getDb(): DatabaseSync {
  if (dbInstance) {
    return dbInstance;
  }

  const dataDir = path.join(process.cwd(), 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const dbPath = path.join(dataDir, 'smart_gate.db');
  dbInstance = new DatabaseSync(dbPath);

  // Enable WAL mode & foreign keys for performance and data integrity
  dbInstance.exec('PRAGMA journal_mode = WAL;');
  dbInstance.exec('PRAGMA foreign_keys = ON;');

  // Initialize schema if not present
  const schemaPath = path.join(process.cwd(), 'src', 'lib', 'schema.sql');
  if (fs.existsSync(schemaPath)) {
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    dbInstance.exec(schemaSql);
  }

  return dbInstance;
}

export function query<T = any>(sql: string, ...params: any[]): T[] {
  const db = getDb();
  const stmt = db.prepare(sql);
  return stmt.all(...params) as T[];
}

export function queryOne<T = any>(sql: string, ...params: any[]): T | undefined {
  const db = getDb();
  const stmt = db.prepare(sql);
  return (stmt.get(...params) as T) || undefined;
}

export function execute(sql: string, ...params: any[]): { changes: number; lastInsertRowid: number | bigint } {
  const db = getDb();
  const stmt = db.prepare(sql);
  const result = stmt.run(...params);
  return {
    changes: Number(result.changes),
    lastInsertRowid: result.lastInsertRowid,
  };
}
