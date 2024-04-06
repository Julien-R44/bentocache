import type { Knex } from 'knex'

import type { DatabaseAdapter, KnexConfig } from '../types/main.js'

/**
 * Knex adapter for the DatabaseStore
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
