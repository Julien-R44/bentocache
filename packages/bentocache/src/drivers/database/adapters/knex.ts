import type { Knex } from 'knex'

import { DatabaseDriver } from '../database.js'
import type { CreateDriverResult, DatabaseAdapter, KnexConfig } from '../../../types/main.js'

/**
 * Create a knex driver
 * You will need to install the underlying database package (mysql2, pg, sqlite3, etc)
 */
export function knexDriver(options: KnexConfig): CreateDriverResult<DatabaseDriver> {
  return {
    options,
    factory: (config: KnexConfig) => {
      const adapter = new KnexAdapter(config)
      return new DatabaseDriver(adapter, config)
    },
  }
}

/**
 * Knex adapter for the DatabaseDriver
 */
export class KnexAdapter implements DatabaseAdapter {
  #connection: Knex
  #tableName!: string

  constructor(config: KnexConfig) {
    this.#connection = config.connection
  }

  setTableName(tableName: string): void {
    this.#tableName = tableName
  }

  async get(key: string): Promise<{ value: string; expiresAt: number | null } | undefined> {
    const result = await this.#connection
      .from(this.#tableName)
      .select(['value', 'expires_at'])
      .where('key', key)
      .first()

    if (!result) return

    return { value: result.value, expiresAt: result.expires_at }
  }

  async getMany(
    keys: string[],
  ): Promise<{ key: string; value: string; expiresAt: number | null }[]> {
    if (keys.length === 0) return []

    const results = await this.#connection
      .from(this.#tableName)
      .select(['key', 'value', 'expires_at as expiresAt'])
      .whereIn('key', keys)

    return results.map((result) => ({
      key: result.key,
      value: result.value,
      expiresAt: result.expiresAt,
    }))
  }

  async delete(key: string): Promise<boolean> {
    const result = await this.#connection.from(this.#tableName).where('key', key).delete()
    return result > 0
  }

  async deleteMany(keys: string[]): Promise<number> {
    return await this.#connection.from(this.#tableName).whereIn('key', keys).delete()
  }

  async disconnect(): Promise<void> {
    await this.#connection.destroy()
  }

  async createTableIfNotExists(): Promise<void> {
    const hasTable = await this.#connection.schema.hasTable(this.#tableName)
    if (hasTable) return

    await this.#connection.schema.createTable(this.#tableName, (table) => {
      table.string('key', 255).notNullable().primary()
      table.text('value', 'longtext')
      table.timestamp('expires_at').nullable()
    })
  }

  async pruneExpiredEntries(): Promise<void> {
    await this.#connection.from(this.#tableName).where('expires_at', '<', new Date()).delete()
  }

  async clear(prefix: string): Promise<void> {
    await this.#connection.from(this.#tableName).where('key', 'like', `${prefix}%`).delete()
  }

  async set(row: { key: string; value: any; expiresAt: Date | null }): Promise<void> {
    await this.#connection
      .from(this.#tableName)
      .insert({ key: row.key, value: row.value, expires_at: row.expiresAt })
      .onConflict('key')
      .merge(['value', 'expires_at'])
  }
}
