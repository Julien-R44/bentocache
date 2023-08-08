import { type Knex } from 'knex'
import KnexPkg from 'knex'
import type { SqlConfig } from '../../types/main.js'
import { BaseDriver } from '../base_driver.js'

const { knex } = KnexPkg

export abstract class BaseSql extends BaseDriver {
  protected connection: Knex
  protected tableName = 'bentocache'
  protected initialized: Promise<void>
  protected dialect: 'pg' | 'mysql2' | 'better-sqlite3'

  constructor(config: SqlConfig & { dialect: 'pg' | 'mysql2' | 'better-sqlite3' }) {
    super(config)

    this.dialect = config.dialect
    this.tableName = config.tableName || this.tableName
    this.connection = this.#createConnection(config)
    this.initialized = new Promise(async (resolve, reject) => {
      const hasTable = await this.connection.schema.hasTable(this.tableName)

      if (hasTable) {
        resolve()
        return
      }

      this.connection.schema
        .createTable(this.tableName, (table) => {
          table.string('key', 255).notNullable().primary()
          table.text('value', 'longtext')
          table.timestamp('expires_at').nullable()
        })
        .then(() => resolve())
        .catch((err) => reject(err))
    })
  }

  #createConnection(config: SqlConfig) {
    if (typeof config.connection === 'string') {
      return knex({ client: this.dialect, connection: config.connection, useNullAsDefault: true })
    }

    // This looks hacky. Maybe we can find a better way to do this?
    // We check if config.connection is a Knex object
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

  #isExpired(expiration: number) {
    return expiration !== null && expiration < Date.now()
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

    if (!result) {
      return
    }

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

    if (value) {
      await this.delete(key)
    }

    return value
  }

  /**
   * Put a value in the cache
   * Returns true if the value was set, false otherwise
   */
  async set(key: string, value: any, ttl?: number) {
    await this.initialized
    await this.connection
      .from(this.tableName)
      .insert({
        key: this.getItemKey(key),
        value: value,
        expires_at: ttl ? new Date(Date.now() + ttl) : null,
      })
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

    if (!result) {
      return false
    }

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

    const result = await this.connection
      .from(this.tableName)
      .whereIn(
        'key',
        keys.map((key) => this.getItemKey(key))
      )
      .delete()

    return result > 0
  }

  async disconnect() {
    await this.connection.destroy()
  }
}
