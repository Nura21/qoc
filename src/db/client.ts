import { Capacitor } from '@capacitor/core';
import { CapacitorSQLite, SQLiteConnection, type SQLiteDBConnection } from '@capacitor-community/sqlite';
import initSqlJs, { type Database as SqlJsDatabase, type SqlValue } from 'sql.js';

import { V1_INIT_SQL } from './migrations/v1_init';

const DB_NAME = 'quotation_invoice_cepat_db';
const IDB_NAME = 'quotation_invoice_idb';
const IDB_STORE = 'sqlite_binary';
const IDB_KEY = 'main_db_v1';

type DbParam = string | number | boolean | null | undefined;

export interface DbDriver {
  exec(sql: string): Promise<void>;
  run(sql: string, params?: DbParam[]): Promise<void>;
  query<T = Record<string, unknown>>(sql: string, params?: DbParam[]): Promise<T[]>;
  transaction<T>(fn: () => Promise<T>): Promise<T>;
}

function normalizeParams(params?: DbParam[]): SqlValue[] {
  if (!params || params.length === 0) return [];
  return params.map((p) => {
    if (p === undefined || p === null) return null;
    if (typeof p === 'boolean') return p ? 1 : 0;
    return p;
  });
}

function isNodeTestEnv(): boolean {
  return (
    typeof process !== 'undefined' && typeof process.versions === 'object' && typeof process.versions?.node === 'string'
  );
}

async function loadBytesFromIndexedDb(): Promise<Uint8Array | null> {
  if (typeof indexedDB === 'undefined') return null;
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(IDB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(IDB_STORE)) {
          db.createObjectStore(IDB_STORE);
        }
      };
      req.onsuccess = () => {
        const db = req.result;
        const tx = db.transaction(IDB_STORE, 'readonly');
        const store = tx.objectStore(IDB_STORE);
        const getReq = store.get(IDB_KEY);
        getReq.onsuccess = () => {
          db.close();
          const val = getReq.result;
          if (val instanceof Uint8Array) {
            resolve(val);
          } else if (val instanceof ArrayBuffer) {
            resolve(new Uint8Array(val));
          } else {
            resolve(null);
          }
        };
        getReq.onerror = () => {
          db.close();
          resolve(null);
        };
      };
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function saveBytesToIndexedDb(bytes: Uint8Array): Promise<void> {
  if (typeof indexedDB === 'undefined') return;
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(IDB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(IDB_STORE)) {
          db.createObjectStore(IDB_STORE);
        }
      };
      req.onsuccess = () => {
        const db = req.result;
        const tx = db.transaction(IDB_STORE, 'readwrite');
        const store = tx.objectStore(IDB_STORE);
        store.put(bytes, IDB_KEY);
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => {
          db.close();
          resolve();
        };
      };
      req.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

class WebSqlJsDriver implements DbDriver {
  private db: SqlJsDatabase;
  private txDepth = 0;
  private txQueue: Promise<unknown> = Promise.resolve();

  constructor(db: SqlJsDatabase) {
    this.db = db;
  }

  private async persistIfRoot(): Promise<void> {
    if (this.txDepth === 0 && !isNodeTestEnv()) {
      const bytes = this.db.export();
      await saveBytesToIndexedDb(bytes);
    }
  }

  async exec(sql: string): Promise<void> {
    this.db.exec(sql);
    await this.persistIfRoot();
  }

  async run(sql: string, params?: DbParam[]): Promise<void> {
    const safe = normalizeParams(params);
    this.db.run(sql, safe);
    await this.persistIfRoot();
  }

  async query<T = Record<string, unknown>>(sql: string, params?: DbParam[]): Promise<T[]> {
    const safe = normalizeParams(params);
    const stmt = this.db.prepare(sql);
    try {
      if (safe.length > 0) {
        stmt.bind(safe);
      }
      const rows: T[] = [];
      while (stmt.step()) {
        rows.push(stmt.getAsObject() as unknown as T);
      }
      return rows;
    } finally {
      stmt.free();
    }
  }

  async transaction<T>(fn: () => Promise<T>): Promise<T> {
    if (this.txDepth > 0) {
      return fn();
    }
    const runTx = async (): Promise<T> => {
      this.txDepth++;
      this.db.exec('BEGIN TRANSACTION;');
      try {
        const result = await fn();
        this.db.exec('COMMIT;');
        this.txDepth--;
        await this.persistIfRoot();
        return result;
      } catch (err) {
        try {
          this.db.exec('ROLLBACK;');
        } catch {
          // ignore rollback error
        }
        this.txDepth = 0;
        throw err;
      }
    };
    const next = this.txQueue.then(runTx, runTx);
    this.txQueue = next.then(
      () => undefined,
      () => undefined,
    );
    return next;
  }
}

class NativeCapacitorDriver implements DbDriver {
  private conn: SQLiteDBConnection;
  private txDepth = 0;
  private txQueue: Promise<unknown> = Promise.resolve();

  constructor(conn: SQLiteDBConnection) {
    this.conn = conn;
  }

  async exec(sql: string): Promise<void> {
    await this.conn.execute(sql, this.txDepth === 0);
  }

  async run(sql: string, params?: DbParam[]): Promise<void> {
    const safe = normalizeParams(params);
    await this.conn.run(sql, safe, this.txDepth === 0);
  }

  async query<T = Record<string, unknown>>(sql: string, params?: DbParam[]): Promise<T[]> {
    const safe = normalizeParams(params);
    const res = await this.conn.query(sql, safe);
    return (res.values ?? []) as T[];
  }

  async transaction<T>(fn: () => Promise<T>): Promise<T> {
    if (this.txDepth > 0) {
      return fn();
    }
    const runTx = async (): Promise<T> => {
      this.txDepth++;
      await this.conn.execute('BEGIN TRANSACTION;', false);
      try {
        const result = await fn();
        await this.conn.execute('COMMIT;', false);
        this.txDepth--;
        return result;
      } catch (err) {
        try {
          await this.conn.execute('ROLLBACK;', false);
        } catch {
          // ignore rollback error
        }
        this.txDepth = 0;
        throw err;
      }
    };
    const next = this.txQueue.then(runTx, runTx);
    this.txQueue = next.then(
      () => undefined,
      () => undefined,
    );
    return next;
  }
}

let driverPromise: Promise<DbDriver> | null = null;
const listeners = new Set<() => void>();

export function notifyDbChanged(): void {
  listeners.forEach((cb) => {
    try {
      cb();
    } catch {
      // ignore listener errors
    }
  });
}

export function subscribeDbChanges(callback: () => void): () => void {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}

async function createDriver(): Promise<DbDriver> {
  if (Capacitor.isNativePlatform()) {
    const sqlite = new SQLiteConnection(CapacitorSQLite);
    const ret = await sqlite.checkConnectionsConsistency();
    const isConn = (await sqlite.isConnection(DB_NAME, false)).result;
    const conn =
      ret.result && isConn
        ? await sqlite.retrieveConnection(DB_NAME, false)
        : await sqlite.createConnection(DB_NAME, false, 'no-encryption', 1, false);
    await conn.open();
    const driver = new NativeCapacitorDriver(conn);
    await driver.exec(V1_INIT_SQL);
    return driver;
  }

  const SQL = await initSqlJs(
    isNodeTestEnv()
      ? undefined
      : {
          locateFile: (file: string) => `/${file}`,
        },
  );
  const saved = isNodeTestEnv() ? null : await loadBytesFromIndexedDb();
  const sqlDb = saved ? new SQL.Database(saved) : new SQL.Database();
  const driver = new WebSqlJsDriver(sqlDb);
  await driver.exec(V1_INIT_SQL);
  return driver;
}

export function getDb(): Promise<DbDriver> {
  if (!driverPromise) {
    driverPromise = createDriver();
  }
  return driverPromise;
}

export async function resetDbForTesting(): Promise<void> {
  const SQL = await initSqlJs();
  const sqlDb = new SQL.Database();
  const driver = new WebSqlJsDriver(sqlDb);
  await driver.exec(V1_INIT_SQL);
  driverPromise = Promise.resolve(driver);
}
