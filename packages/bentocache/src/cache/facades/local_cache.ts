import { CacheEntry } from '../cache_entry/cache_entry.js'
import type { CacheEntryOptions } from '../cache_entry/cache_entry_options.js'
import type { Logger, L1CacheDriver, CacheSerializer } from '../../types/main.js'

/**
 * LocalCache is a wrapper around a CacheDriver that provides a
 * some handy methods for interacting with a local cache ( in-memory )
 */
export class LocalCache {
  #driver: L1CacheDriver
  #logger: Logger
  #serializer: CacheSerializer

  constructor(driver: L1CacheDriver, logger: Logger, serializer: CacheSerializer) {
    this.#driver = driver
    this.#serializer = serializer
    this.#logger = logger.child({ context: 'bentocache.localCache' })
  }

  /**
   * Get an item from the local cache
   */
  get(key: string, options: CacheEntryOptions) {
    /**
     * Try to get the item from the local cache
     */
    this.#logger.trace({ key, opId: options.id }, 'try getting local cache item')
    const value = this.#driver.get(key)

    /**
     * If the item is not found, return undefined
     */
    if (value === undefined) {
      this.#logger.trace({ key, opId: options.id }, 'local cache item not found')
      return
    }

    return CacheEntry.fromDriver(key, value, this.#serializer)
  }

  /**
   * Set a new item in the local cache
   */
  set(key: string, value: string, options: CacheEntryOptions) {
    /**
     * If grace period is disabled and Physical TTL is 0 or less, we can just delete the item.
     */
    if (!options.isGracePeriodEnabled && options.physicalTtl && options.physicalTtl <= 0) {
      return this.delete(key, options)
    }

    /**
     * Save the item to the local cache
     */
    this.#logger.trace({ key, value, opId: options.id }, 'saving local cache item')
    this.#driver.set(key, value, options.physicalTtl)
  }

  /**
   * Delete an item from the local cache
   */
  delete(key: string, options?: CacheEntryOptions) {
    this.#logger.trace({ key, opId: options?.id }, 'deleting local cache item')
    return this.#driver.delete(key)
  }

  /**
   * Make an item logically expire in the local cache
   *
   * That means that the item will be expired but kept in the cache
   * in order to be able to return it to the user if the remote cache
   * is down and the grace period is enabled
   */
  logicallyExpire(key: string) {
    this.#logger.trace({ key }, 'logically expiring local cache item')

    const value = this.#driver.get(key)
    if (value === undefined) return

    const newEntry = CacheEntry.fromDriver(key, value, this.#serializer).expire().serialize()
    return this.#driver.set(key, newEntry, this.#driver.getRemainingTtl(key))
  }

  /**
   * Delete many item from the local cache
   */
  deleteMany(keys: string[], options: CacheEntryOptions) {
    this.#logger.trace({ keys, options, opId: options.id }, 'deleting local cache items')
    this.#driver.deleteMany(keys)
  }

  /**
   * Create a new namespace for the local cache
   */
  namespace(namespace: string) {
    return this.#driver.namespace(namespace) as L1CacheDriver
  }

  /**
   * Check if an item exists in the local cache
   */
  has(key: string) {
    return this.#driver.has(key)
  }

  /**
   * Clear the local cache
   */
  clear() {
    return this.#driver.clear()
  }

  /**
   * Disconnect from the local cache
   */
  disconnect() {
    return this.#driver.disconnect()
  }
}
