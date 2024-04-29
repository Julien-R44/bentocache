import type { DbResult, DefaultColumnTypes, DefaultSchemaConfig } from 'orchid-orm'
import { DatabaseDriver } from '../database.js'
import type { CreateDriverResult, DatabaseAdapter, OrchidConfig } from '../../../types/main.js'

/**
 * Create a orchid driver
 */
export function orchidDriver(options: OrchidConfig): CreateDriverResult<DatabaseDriver> {
  return {
    options,
    factory: (config: OrchidConfig) => {
      const adapter = new OrchidAdapter(config)
      return new DatabaseDriver(adapter, config)
    },
  }
}

/**
 * Orchid adapter for the DatabaseDriver
 */
export class OrchidAdapter implements DatabaseAdapter {
  #connection: DbResult<DefaultColumnTypes<DefaultSchemaConfig>>
  #tableName!: string

  constructor(config: OrchidConfig) {
    this.#connection = config.connection
  }

  private getTable() {
    return this.#connection(this.#tableName, (t) => ({
      key: t.varchar().primaryKey(),
      value: t.varchar(),
      expires_at: t
        .timestampNoTZ()
        .encode((value: Date) => value)
        .parse((v: any): number => (v ? new Date(v).valueOf() : v))
        .nullable(),
    }))
  }

  setTableName(tableName: string): void {
    this.#tableName = tableName
  }

  async get(key: string): Promise<{ value: string; expiresAt: number | null } | undefined> {
    const result = await this.getTable().findByOptional({ key }).select('value', 'expires_at')

    if (!result) return

    return { value: result.value, expiresAt: result.expires_at }
  }

  async delete(key: string): Promise<boolean> {
    const count = await this.getTable().where({ key }).delete()
    return count > 0
  }

  async deleteMany(keys: string[]): Promise<number> {
    return await this.getTable().whereIn('key', keys).delete()
  }

  async disconnect(): Promise<void> {
    await this.#connection.close()
  }

  async createTableIfNotExists(): Promise<void> {
    // TODO
    // throw new Error('Do not support create table')
  }

  async pruneExpiredEntries(): Promise<void> {
    await this.getTable()
      .where({ expires_at: { lt: new Date() } })
      .delete()
  }

  async clear(prefix: string): Promise<void> {
    await this.getTable()
      .where({ key: { startsWith: prefix } })
      .delete()
  }

  async set(row: { key: string; value: any; expiresAt: Date | null }): Promise<void> {
    await this.getTable()
      .findBy({ key: row.key })
      .upsert({
        create: {
          key: row.key,
          value: row.value,
          expires_at: row.expiresAt,
        },
        update: {
          value: row.value,
          expires_at: row.expiresAt,
        },
      })
  }
}
