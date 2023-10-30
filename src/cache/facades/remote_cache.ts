import { CacheEntry } from '../cache_entry/cache_entry.js'
import type { CacheDriver, Logger } from '../../types/main.js'
import type { CacheEntryOptions } from '../cache_entry/cache_entry_options.js'

/**
 * RemoteCache is a wrapper around a CacheDriver that provides
 * some handy methods for interacting with a remote cache ( redis, database, etc )
 */
export class RemoteCache {
  #driver: CacheDriver
  #logger: Logger

  constructor(driver: CacheDriver, logger: Logger) {
    this.#driver = driver
    this.#logger = logger.child({ context: 'bentocache.remoteCache' })
  }

  /**
   * Rethrow the error if suppressRemoteCacheErrors is disabled
   */
  #maybeRethrowError(error: Error, options: CacheEntryOptions) {
    if (options.suppressRemoteCacheErrors === false) {
      throw error
    }
  }

  /**
   * Get an item from the remote cache
   */
  async get(key: string, options: CacheEntryOptions) {
    let value: undefined | string
    try {
      value = await this.#driver.get(key)
      if (value === undefined) return

      return CacheEntry.fromDriver(key, value)
    } catch (error) {
      this.#logger.error({ key, error }, 'error getting remote cache item')
      this.#maybeRethrowError(error, options)

      return undefined
    }
  }

  /**
   * Set a new item in the remote cache
   */
  async set(key: string, value: string, options: CacheEntryOptions) {
    try {
      this.#logger.trace({ key, value, opId: options.id }, 'saving remote cache item')
      await this.#driver.set(key, value, options.physicalTtl)
    } catch (error) {
      this.#logger.error({ key, value, error, opId: options.id }, 'error saving remote cache item')
      this.#maybeRethrowError(error, options)

      return false
    }
  }

  /**
   * Delete an item from the remote cache
   */
  async delete(key: string, options: CacheEntryOptions) {
    try {
      this.#logger.trace({ key, opId: options.id }, 'deleting remote cache item')
      return await this.#driver.delete(key)
    } catch (error) {
      this.#logger.error({ key, error, opId: options.id }, 'error deleting remote cache item')
      this.#maybeRethrowError(error, options)

      return false
    }
  }

  /**
   * Delete multiple items from the remote cache
   */
  async deleteMany(keys: string[], options: CacheEntryOptions) {
    try {
      this.#logger.trace({ keys, opId: options.id }, 'deleting remote cache items')
      await this.#driver.deleteMany(keys)
    } catch (error) {
      this.#logger.error({ keys, opId: options.id, error }, 'error deleting remote cache items')
      this.#maybeRethrowError(error, options)

      return false
    }
  }

  /**
   * Create a new namespace for the remote cache
   */
  namespace(namespace: string) {
    return this.#driver.namespace(namespace)
  }

  /**
   * Check if an item exists in the remote cache
   */
  has(key: string) {
    return this.#driver.has(key)
  }

  /**
   * Clear the remote cache
   */
  clear() {
    return this.#driver.clear()
  }

  /**
   * Disconnect from the remote cache
   */
  disconnect() {
    return this.#driver.disconnect()
  }
}
