import type { Memory } from '../../drivers/memory.js'
import { CacheEntry } from '../cache_entry/cache_entry.js'
import type { Logger, CacheDriver } from '../../types/main.js'
import type { CacheEntryOptions } from '../cache_entry/cache_entry_options.js'

/**
 * LocalCache is a wrapper around a CacheDriver that provides a
 * some handy methods for interacting with a local cache ( in-memory )
 */
export class LocalCache {
  #driver: CacheDriver<false>
  #logger: Logger

  constructor(driver: CacheDriver<false>, logger: Logger) {
    this.#driver = driver
    this.#logger = logger.child({ context: 'bentocache.localCache' })
  }

  /**
   * Get an item from the local cache
   */
  get(key: string, options: CacheEntryOptions) {
    let value: undefined | string

    /**
     * Try to get the item from the local cache
     */
    this.#logger.trace({ key, opId: options.id }, 'try getting local cache item')
    value = this.#driver.get(key)

    /**
     * If the item is not found, return undefined
     */
    if (value === undefined) {
      this.#logger.trace({ key, opId: options.id }, 'local cache item not found')
      return
    }

    return CacheEntry.fromDriver(key, value)
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

  logicallyExpire(key: string) {
    this.#logger.trace({ key }, 'logically expiring local cache item')

    // TODO This is a nasty hack that needs to be fixed
    const driver = this.#driver as Memory
    const value = this.#driver.get(key)
    if (value === undefined) return

    return this.#driver.set(
      key,
      CacheEntry.fromDriver(key, value).expire().serialize(),
      driver.getRemainingTtl(key)
    )
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
    return this.#driver.namespace(namespace)
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
