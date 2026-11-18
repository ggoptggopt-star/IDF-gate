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

  // Safe migrations for newly added columns if table already exists
  try {
    dbInstance.exec(`ALTER TABLE leave_requests ADD COLUMN is_return_required INTEGER NOT NULL DEFAULT 1;`);
  } catch {}
  try {
    dbInstance.exec(`ALTER TABLE leave_requests ADD COLUMN trip_stage TEXT DEFAULT 'not_started';`);
  } catch {}
  try {
    dbInstance.exec(`ALTER TABLE leave_requests ADD COLUMN dest_arrived_at TEXT;`);
  } catch {}
  try {
    dbInstance.exec(`ALTER TABLE leave_requests ADD COLUMN return_arrived_at TEXT;`);
  } catch {}
  try {
    dbInstance.exec(`ALTER TABLE leave_requests ADD COLUMN current_lat REAL;`);
  } catch {}
  try {
    dbInstance.exec(`ALTER TABLE leave_requests ADD COLUMN current_lng REAL;`);
  } catch {}
  try {
    dbInstance.exec(`ALTER TABLE users ADD COLUMN home_lat REAL;`);
  } catch {}
  try {
    dbInstance.exec(`ALTER TABLE users ADD COLUMN home_lng REAL;`);
  } catch {}
  try {
    dbInstance.exec(`ALTER TABLE users ADD COLUMN home_address TEXT;`);
  } catch {}
  try {
    dbInstance.exec(`ALTER TABLE users ADD COLUMN is_face_enrolled INTEGER DEFAULT 0;`);
  } catch {}
  try {
    dbInstance.exec(`ALTER TABLE users ADD COLUMN face_enrolled_at TEXT;`);
  } catch {}
  try {
    dbInstance.exec(`ALTER TABLE face_embeddings ADD COLUMN snapshot_straight TEXT;`);
  } catch {}
  try {
    dbInstance.exec(`ALTER TABLE face_embeddings ADD COLUMN snapshot_left TEXT;`);
  } catch {}
  try {
    dbInstance.exec(`ALTER TABLE face_embeddings ADD COLUMN snapshot_right TEXT;`);
  } catch {}
  try {
    dbInstance.exec(`ALTER TABLE face_embeddings ADD COLUMN snapshot_smile TEXT;`);
  } catch {}
  try {
    dbInstance.exec(`ALTER TABLE face_embeddings ADD COLUMN liveness_score REAL DEFAULT 0.985;`);
  } catch {}

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
