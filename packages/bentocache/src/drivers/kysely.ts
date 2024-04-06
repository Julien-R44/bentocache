import { SqliteAdapter, type Kysely } from 'kysely'

import type { DatabaseAdapter, KyselyConfig } from '../types/main.js'

/**
 * Kysely adapter for the DatabaseDriver
 */
export class KyselyAdapter implements DatabaseAdapter {
  #isSqlite: boolean
  #tableName!: string
  #connection: Kysely<any>

  constructor(config: KyselyConfig) {
    this.#connection = config.connection
    this.#isSqlite = config.connection.getExecutor().adapter instanceof SqliteAdapter
  }

  setTableName(tableName: string): void {
    this.#tableName = tableName
  }

  async get(key: string): Promise<{ value: any; expiresAt: number | null } | undefined> {
    const result = await this.#connection
      .selectFrom(this.#tableName)
      .select(['value', 'expires_at'])
      .where('key', '=', key)
      .executeTakeFirst()

    if (!result) return

    return { value: result.value, expiresAt: result.expires_at }
  }

  async delete(key: string): Promise<boolean> {
    const result = await this.#connection
      .deleteFrom(this.#tableName)
      .where('key', '=', key)
      .executeTakeFirst()

    return result.numDeletedRows > 0
  }

  async deleteMany(keys: string[]): Promise<number> {
    const result = await this.#connection
      .deleteFrom(this.#tableName)
      .where('key', 'in', keys)
      .executeTakeFirst()

    return +result.numDeletedRows.toString()
  }

  async disconnect(): Promise<void> {
    await this.#connection.destroy()
  }

  async createTableIfNotExists(): Promise<void> {
    await this.#connection.schema
      .createTable(this.#tableName)
      .addColumn('key', 'varchar(255)', (col) => col.primaryKey().notNull())
      .addColumn('value', 'text')
      .addColumn('expires_at', 'bigint')
      .ifNotExists()
      .execute()
  }

  async pruneExpiredEntries(): Promise<void> {
    await this.#connection
      .deleteFrom(this.#tableName)
      .where('expires_at', '<', Date.now())
      .execute()
  }

  async clear(prefix: string): Promise<void> {
    await this.#connection.deleteFrom(this.#tableName).where('key', 'like', `${prefix}%`).execute()
  }

  async set(row: { value: any; key: string; expiresAt: Date | null }): Promise<void> {
    const expiresAt = this.#isSqlite ? row.expiresAt?.getTime() : row.expiresAt

    await this.#connection
      .insertInto(this.#tableName)
      .values({ key: row.key, value: row.value, expires_at: expiresAt ?? null })
      // .onConflict((conflict) =>
      //   conflict.columns(['key']).doUpdateSet({ value: row.value, expires_at: row.expiresAt }),
      // )
      .execute()
  }
}
