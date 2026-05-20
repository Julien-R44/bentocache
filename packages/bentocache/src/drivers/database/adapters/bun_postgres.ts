import { SQL } from 'bun'

import { DatabaseDriver } from '../database.js'
import type { BunPostgresConfig, CreateDriverResult, DatabaseAdapter } from '../../../types/main.js'

export function bunPostgresDriver(options: BunPostgresConfig): CreateDriverResult<DatabaseDriver> {
  return {
    options,
    factory: (config: BunPostgresConfig) => {
      const adapter = new BunPostgresAdapter(config)
      return new DatabaseDriver(adapter, config)
    },
  }
}

export class BunPostgresAdapter implements DatabaseAdapter {
  #sql: SQL
  #tableName!: string

  constructor(config: BunPostgresConfig) {
    this.#sql = config.connection instanceof SQL ? config.connection : new SQL(config.connection)
  }

  setTableName(tableName: string) {
    this.#tableName = tableName
  }

  #table() {
    return this.#sql(this.#tableName)
  }

  async get(key: string) {
    const rows = await this.#sql<
      Array<{ value: string; expires_at: number | string | null }>
    >`SELECT value, expires_at FROM ${this.#table()} WHERE key = ${key}`

    const row = rows[0]
    if (!row) return

    return {
      value: row.value,
      expiresAt:
        row.expires_at !== null && row.expires_at !== undefined ? Number(row.expires_at) : null,
    }
  }

  async set(row: { key: string; value: any; expiresAt: Date | null }) {
    const expiresAt = row.expiresAt?.getTime() ?? null

    await this.#sql`
      INSERT INTO ${this.#table()} (key, value, expires_at)
      VALUES (${row.key}, ${row.value}, ${expiresAt})
      ON CONFLICT (key) DO UPDATE
        SET value = EXCLUDED.value, expires_at = EXCLUDED.expires_at
    `
  }

  async delete(key: string) {
    const result = await this.#sql`DELETE FROM ${this.#table()} WHERE key = ${key}`
    return (result.count ?? 0) > 0
  }

  async deleteMany(keys: string[]) {
    let count = 0
    for (const key of keys) {
      const result = await this.#sql`DELETE FROM ${this.#table()} WHERE key = ${key}`
      count += result.count ?? 0
    }
    return count
  }

  async createTableIfNotExists() {
    await this.#sql`
      CREATE TABLE IF NOT EXISTS ${this.#table()} (
        key VARCHAR(255) PRIMARY KEY NOT NULL,
        value TEXT,
        expires_at BIGINT
      )
    `
  }

  async pruneExpiredEntries() {
    await this.#sql`DELETE FROM ${this.#table()} WHERE expires_at < ${Date.now()}`
  }

  async clear(prefix: string) {
    await this.#sql`DELETE FROM ${this.#table()} WHERE key LIKE ${`${prefix}%`}`
  }

  async disconnect() {
    await this.#sql.end()
  }
}
