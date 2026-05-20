import { Database } from 'bun:sqlite'
import type { Statement } from 'bun:sqlite'

import { DatabaseDriver } from '../database.js'
import type { BunSqliteConfig, CreateDriverResult, DatabaseAdapter } from '../../../types/main.js'

export function bunSqliteDriver(options: BunSqliteConfig): CreateDriverResult<DatabaseDriver> {
  return {
    options,
    factory: (config: BunSqliteConfig) => {
      const adapter = new BunSqliteAdapter(config)
      return new DatabaseDriver(adapter, config)
    },
  }
}

interface CachedStatements {
  get: Statement<{ value: string; expires_at: number | null }, [string]>
  set: Statement<unknown, [string, string, number | null]>
  delete: Statement<unknown, [string]>
  prune: Statement<unknown, [number]>
  clear: Statement<unknown, [string]>
}

export class BunSqliteAdapter implements DatabaseAdapter {
  #db: Database
  #tableName!: string
  #statements?: CachedStatements

  constructor(config: BunSqliteConfig) {
    this.#db =
      config.connection instanceof Database
        ? config.connection
        : new Database(config.connection, config.options)
  }

  setTableName(tableName: string) {
    this.#tableName = tableName
  }

  #prepared(): CachedStatements {
    if (this.#statements) return this.#statements

    this.#statements = {
      get: this.#db.prepare(`SELECT value, expires_at FROM ${this.#tableName} WHERE key = ?`),
      set: this.#db.prepare(
        `INSERT INTO ${this.#tableName} (key, value, expires_at) VALUES (?, ?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, expires_at = excluded.expires_at`,
      ),
      delete: this.#db.prepare(`DELETE FROM ${this.#tableName} WHERE key = ?`),
      prune: this.#db.prepare(`DELETE FROM ${this.#tableName} WHERE expires_at < ?`),
      clear: this.#db.prepare(`DELETE FROM ${this.#tableName} WHERE key LIKE ?`),
    }

    return this.#statements
  }

  async get(key: string) {
    const row = this.#prepared().get.get(key)
    if (!row) return
    return { value: row.value, expiresAt: row.expires_at }
  }

  async set(row: { key: string; value: any; expiresAt: Date | null }) {
    this.#prepared().set.run(row.key, row.value, row.expiresAt?.getTime() ?? null)
  }

  async delete(key: string) {
    return this.#prepared().delete.run(key).changes > 0
  }

  async deleteMany(keys: string[]) {
    const stmt = this.#prepared().delete
    const tx = this.#db.transaction((ks: string[]) => {
      let count = 0
      for (const k of ks) count += stmt.run(k).changes
      return count
    })
    return tx(keys)
  }

  async createTableIfNotExists() {
    this.#db.exec(
      `CREATE TABLE IF NOT EXISTS ${this.#tableName} (
        key TEXT PRIMARY KEY NOT NULL,
        value TEXT,
        expires_at INTEGER
      )`,
    )
  }

  async pruneExpiredEntries() {
    this.#prepared().prune.run(Date.now())
  }

  async clear(prefix: string) {
    this.#prepared().clear.run(`${prefix}%`)
  }

  async disconnect() {
    this.#db.close(false)
  }
}
