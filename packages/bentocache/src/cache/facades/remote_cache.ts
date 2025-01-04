import { CacheEntry } from '../cache_entry/cache_entry.js'
import type { CacheEntryOptions } from '../cache_entry/cache_entry_options.js'
import type { CacheSerializer, L2CacheDriver, Logger } from '../../types/main.js'

/**
 * RemoteCache is a wrapper around a L2 Cache Driver that provides
 * some handy methods for interacting with a remote cache ( redis, database, etc )
 */
export class RemoteCache {
  #driver: L2CacheDriver
  #logger: Logger
  #serializer: CacheSerializer

  constructor(driver: L2CacheDriver, logger: Logger, serializer: CacheSerializer) {
    this.#driver = driver
    this.#serializer = serializer
    this.#logger = logger.child({ context: 'bentocache.remoteCache' })
  }

  /**
   * Try to execute a cache operation and fallback to a default value
   * if the operation fails
   */
  async #tryCacheOperation(
    operation: string,
    options: CacheEntryOptions,
    fallbackValue: unknown,
    fn: () => any,
  ) {
    try {
      return await fn()
    } catch (error) {
      this.#logger.error({ error, opId: options.id }, `(${operation}) failed on remote cache`)

      /**
       * Rethrow the error if suppressL2Errors is disabled
       */
      if (options.suppressL2Errors === false) throw error

      return fallbackValue
    }
  }

  /**
   * Get an item from the remote cache
   */
  async get(key: string, options: CacheEntryOptions) {
    return await this.#tryCacheOperation('get', options, undefined, async () => {
      const value = await this.#driver.get(key)
      if (value === undefined) return

      return CacheEntry.fromDriver(key, value, this.#serializer)
    })
  }

  /**
   * Set a new item in the remote cache
   */
  async set(key: string, value: string, options: CacheEntryOptions) {
    return await this.#tryCacheOperation('set', options, false, async () => {
      await this.#driver.set(key, value, options.physicalTtl)
      return true
    })
  }

  /**
   * Delete an item from the remote cache
   */
  async delete(key: string, options: CacheEntryOptions) {
    return await this.#tryCacheOperation('delete', options, false, async () => {
      return await this.#driver.delete(key)
    })
  }

  /**
   * Delete multiple items from the remote cache
   */
  async deleteMany(keys: string[], options: CacheEntryOptions) {
    return await this.#tryCacheOperation('deleteMany', options, false, async () => {
      return await this.#driver.deleteMany(keys)
    })
  }

  /**
   * Create a new namespace for the remote cache
   */
  namespace(namespace: string) {
    return this.#driver.namespace(namespace) as L2CacheDriver
  }

  /**
   * Check if an item exists in the remote cache
   */
  async has(key: string, options: CacheEntryOptions) {
    return await this.#tryCacheOperation('has', options, false, async () => {
      return await this.#driver.has(key)
    })
  }

  /**
   * Clear the remote cache
   */
  async clear(options: CacheEntryOptions) {
    return await this.#tryCacheOperation('clear', options, false, async () => {
      return await this.#driver.clear()
    })
  }

  /**
   * Disconnect from the remote cache
   */
  disconnect() {
    return this.#driver.disconnect()
  }
}
