import { asyncNoop, once } from '@julr/utils/functions'

import { resolveTtl } from '../../helpers.js'
import { BaseDriver } from '../base_driver.js'
import type { DatabaseConfig, CacheDriver, DatabaseAdapter } from '../../types/main.js'

/**
 * A store that use a database to store cache entries
 *
 * You should provide an adapter that will handle the database interactions
 */
export class DatabaseDriver extends BaseDriver implements CacheDriver<true> {
  type = 'l2' as const

  /**
   * The underlying adapter
   */
  #adapter: DatabaseAdapter

  /**
   * Initialize by creating the table
   */
  #initializer: () => Promise<any>

  /**
   * Pruning interval
   */
  #pruneInterval?: NodeJS.Timeout

  constructor(adapter: DatabaseAdapter, config: DatabaseConfig, isNamespace = false) {
    super(config)
    this.#adapter = adapter

    if (isNamespace) {
      this.#initializer = asyncNoop
      return
    }

    this.#adapter.setTableName(config.tableName || 'bentocache')

    if (config.autoCreateTable !== false) {
      this.#initializer = once(async () => await this.#adapter.createTableIfNotExists())
    } else {
      this.#initializer = asyncNoop
    }

    if (config.pruneInterval === false) return
    this.#startPruneInterval(resolveTtl(config.pruneInterval)!)
  }

  /**
   * Start the interval that will prune expired entries
   * Maybe rework this using a node Worker ?
   */
  #startPruneInterval(interval: number) {
    this.#pruneInterval = setInterval(async () => {
      await this.#initializer()
      await this.#adapter
        .pruneExpiredEntries()
        .catch((err) => console.error('[bentocache] failed to prune expired entries', err))
    }, interval)
  }

  /**
   * Check if the given timestamp is expired
   */
  #isExpired(expiration: number | null) {
    return expiration !== null && expiration < Date.now()
  }

  /**
   * Returns a new instance of the driver namespaced
   */
  namespace(namespace: string) {
    const store = new (this.constructor as any)(
      this.#adapter,
      { ...this.config, prefix: this.createNamespacePrefix(namespace) },
      true,
    )

    return store
  }

  /**
   * Get a value from the cache
   */
  async get(key: string) {
    await this.#initializer()

    const result = await this.#adapter.get(this.getItemKey(key))
    if (!result) return

    if (this.#isExpired(result.expiresAt)) {
      await this.#adapter.delete(key)
      return
    }

    return result.value
  }

  /**
   * Get the value of a key and delete it
   *
   * Returns the value if the key exists, undefined otherwise
   */
  async pull(key: string): Promise<string | undefined> {
    const value = await this.get(key)
    if (value) await this.delete(key)

    return value
  }

  /**
   * Set a value in the cache
   * Returns true if the value was set, false otherwise
   */
  async set(key: string, value: any, ttl?: number) {
    await this.#initializer()
    await this.#adapter.set({
      key: this.getItemKey(key),
      value,
      expiresAt: ttl ? new Date(Date.now() + ttl) : null,
    })

    return true
  }

  /**
   * Remove all items from the cache
   */
  async clear() {
    await this.#initializer()

    await this.#adapter.clear(`${this.prefix}:`)
  }

  /**
   * Delete a key from the cache
   * Returns true if the key was deleted, false otherwise
   */
  async delete(key: string) {
    await this.#initializer()
    return this.#adapter.delete(this.getItemKey(key))
  }

  /**
   * Delete multiple keys from the cache
   */
  async deleteMany(keys: string[]) {
    if (keys.length === 0) return true
    await this.#initializer()

    keys = keys.map((key) => this.getItemKey(key))
    const result = await this.#adapter.deleteMany(keys)

    return result > 0
  }

  /**
   * Disconnect from the database
   */
  async disconnect() {
    if (this.#pruneInterval) {
      clearInterval(this.#pruneInterval)
    }

    await this.#adapter.disconnect()
  }
}
