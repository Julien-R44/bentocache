import KnexPkg from 'knex'
import { type Knex } from 'knex'

import { BaseDriver } from './base_driver.js'
import type { DialectName, SqlConfig } from '../types/main.js'

const { knex } = KnexPkg

/**
 * A Knex based driver for SQL databases
 *
 * Some notes :
 * - when creating a new instance of a driver, we
 *   gonna check if the cache table exists. If it doesn't, we gonna
 *   create it
 *
 * - Since SQL doesn't have the concept of TTLs, we store the
 *   expiration date in the cache table. Then we a value from
 *   the table, we check if it's expired. If it is, we delete the row
 */
export class Sql extends BaseDriver {
  type = 'l2' as const

  /**
   * Knex connection instance
   */
  protected connection: Knex

  /**
   * The name of the table used to store the cache
   */
  protected tableName = 'bentocache'

  /**
   * A promise that resolves when the table is created
   */
  protected initialized: Promise<void>

  /**
   * The SQL dialect used by the driver
   */
  protected dialect: DialectName

  constructor(config: SqlConfig & { dialect: DialectName }) {
    super(config)

    this.dialect = config.dialect
    this.tableName = config.tableName || this.tableName
    this.connection = this.#createConnection(config)
    this.initialized = this.#createTableIfNotExists()
  }

  /**
   * Create the cache table if it doesn't exist
   */
  async #createTableIfNotExists() {
    const hasTable = await this.connection.schema.hasTable(this.tableName)
    if (hasTable) return

    await this.connection.schema.createTable(this.tableName, (table) => {
      table.string('key', 255).notNullable().primary()
      table.text('value', 'longtext')
      table.timestamp('expires_at').nullable()
    })
  }

  /**
   * Check if the given timestamp is expired
   */
  #isExpired(expiration: number) {
    return expiration !== null && expiration < Date.now()
  }

  /**
   * Create a Knex connection instance
   */
  #createConnection(config: SqlConfig) {
    if (typeof config.connection === 'string') {
      return knex({ client: this.dialect, connection: config.connection, useNullAsDefault: true })
    }

    /**
     * This looks hacky. Maybe we can find a better way to do this?
     * We check if config.connection is a Knex object. If it is, we
     * return it as is. If it's not, we create a new Knex object
     */
    if ('with' in config.connection!) {
      return config.connection
    }

    return knex({ client: this.dialect, connection: config.connection, useNullAsDefault: true })
  }

  /**
   * Returns a new instance of the driver namespaced
   */
  namespace(namespace: string) {
    return new (this.constructor as any)({
      ...this.config,
      connection: this.connection,
      prefix: this.createNamespacePrefix(namespace),
    })
  }

  /**
   * Get a value from the cache
   */
  async get(key: string) {
    await this.initialized

    const result = await this.connection
      .from(this.tableName)
      .select(['value', 'expires_at'])
      .where('key', this.getItemKey(key))
      .first()

    if (!result) return

    if (this.#isExpired(result.expires_at)) {
      await this.delete(key)
      return
    }

    return result.value
  }

  /**
   * Get the value of a key and delete it
   *
   * Returns the value if the key exists, undefined otherwise
   */
  async pull(key: string) {
    const value = await this.get(key)
    if (value) await this.delete(key)

    return value
  }

  /**
   * Set a value in the cache
   * Returns true if the value was set, false otherwise
   */
  async set(key: string, value: any, ttl?: number) {
    await this.initialized

    const row = {
      key: this.getItemKey(key),
      value: value,
      expires_at: ttl ? new Date(Date.now() + ttl) : null,
    }

    await this.connection
      .from(this.tableName)
      .insert(row)
      .onConflict('key')
      .merge(['value', 'expires_at'])

    return true
  }

  /**
   * Check if a key exists in the cache
   */
  async has(key: string) {
    await this.initialized

    const result = await this.connection
      .from(this.tableName)
      .select(['expires_at'])
      .where('key', this.getItemKey(key))
      .first()

    if (!result) return false

    if (this.#isExpired(result.expires_at)) {
      await this.delete(key)
      return false
    }

    return true
  }

  /**
   * Remove all items from the cache
   */
  async clear() {
    await this.initialized

    await this.connection.from(this.tableName).where('key', 'like', `${this.prefix}%`).delete()
  }

  /**
   * Delete a key from the cache
   * Returns true if the key was deleted, false otherwise
   */
  async delete(key: string) {
    await this.initialized

    const result = await this.connection
      .from(this.tableName)
      .where('key', this.getItemKey(key))
      .delete()

    return result > 0
  }

  /**
   * Delete multiple keys from the cache
   */
  async deleteMany(keys: string[]) {
    await this.initialized

    keys = keys.map((key) => this.getItemKey(key))
    const result = await this.connection.from(this.tableName).whereIn('key', keys).delete()

    return result > 0
  }

  /**
   * Disconnect from the database
   */
  async disconnect() {
    await this.connection.destroy()
  }
}
