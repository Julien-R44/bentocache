import type { Logger } from '../../logger.js'
import { CacheEntry } from '../cache_entry/cache_entry.js'
import type { L1CacheDriver, CacheSerializer } from '../../types/main.js'
import type { CacheEntryOptions } from '../cache_entry/cache_entry_options.js'

/**
 * LocalCache is a wrapper around a CacheDriver that provides a
 * some handy methods for interacting with a local cache ( in-memory )
 */
export class LocalCache {
  #driver: L1CacheDriver
  #logger: Logger
  #serializer: CacheSerializer | undefined

  constructor(driver: L1CacheDriver, logger: Logger, serializer: CacheSerializer | undefined) {
    this.#driver = driver
    this.#serializer = serializer
    this.#logger = logger.child({ layer: 'l1' })
  }

  /**
   * Get an item from the local cache
   */
  get(key: string, options: CacheEntryOptions) {
    /**
     * Try to get the item from the local cache
     */
    this.#logger.trace({ key, opId: options.id }, 'try getting from l1 cache')
    const value = this.#driver.get(key)

    /**
     * If the item is not found, return undefined
     */
    if (value === undefined) {
      this.#logger.debug({ key, opId: options.id }, 'cache miss')
      return
    }

    const entry = CacheEntry.fromDriver(key, value, this.#serializer)
    const isGraced = entry.isLogicallyExpired()
    if (isGraced) {
      this.#logger.debug({ key, opId: options.id }, 'cache hit (graced)')
    } else {
      this.#logger.debug({ key, opId: options.id }, 'cache hit')
    }

    return { entry, isGraced }
  }

  /**
   * Batch get many items from the local cache
   */
  getMany(keys: string[], options: CacheEntryOptions) {
    this.#logger.debug({ keys, opId: options.id }, 'batch getting items from l1 cache')
    return keys.map((key) => this.get(key, options))
  }

  /**
   * Set a new item in the local cache
   */
  set(key: string, value: any, options: CacheEntryOptions) {
    /**
     * If grace period is disabled and Physical TTL is 0 or less, we can just delete the item.
     */
    const physicalTtl = options.getPhysicalTtl()
    if (!options.isGraceEnabled() && physicalTtl && physicalTtl <= 0) {
      return this.delete(key, options)
    }

    /**
     * Save the item to the local cache
     */
    this.#logger.debug({ key, opId: options.id }, 'saving item')
    this.#driver.set(key, value, physicalTtl)
  }

  /**
   * Delete an item from the local cache
   */
  delete(key: string, options?: CacheEntryOptions) {
    this.#logger.debug({ key, opId: options?.id }, 'deleting item')
    return this.#driver.delete(key)
  }

  /**
   * Delete many item from the local cache
   */
  deleteMany(keys: string[], options: CacheEntryOptions) {
    this.#logger.debug({ keys, options, opId: options.id }, 'deleting items')
    this.#driver.deleteMany(keys)
  }

  /**
   * Make an item logically expire in the local cache
   */
  logicallyExpire(key: string, options?: CacheEntryOptions) {
    this.#logger.debug({ key, opId: options?.id }, 'logically expiring item')

    const value = this.#driver.get(key)
    if (value === undefined) return

    const newEntry = CacheEntry.fromDriver(key, value, this.#serializer).expire().serialize()
    return this.#driver.set(key, newEntry as any, this.#driver.getRemainingTtl(key))
  }

  /**
   * Create a new namespace for the local cache
   */
  namespace(namespace: string) {
    return this.#driver.namespace(namespace) as L1CacheDriver
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
