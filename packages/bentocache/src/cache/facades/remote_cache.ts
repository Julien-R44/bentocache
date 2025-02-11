import { is } from '@julr/utils/is'

import { CacheEntry } from '../cache_entry/cache_entry.js'
import { CircuitBreaker } from '../../circuit_breaker/index.js'
import type { L2CacheDriver, Logger } from '../../types/main.js'
import type { BentoCacheOptions } from '../../bento_cache_options.js'
import type { CacheEntryOptions } from '../cache_entry/cache_entry_options.js'

/**
 * RemoteCache is a wrapper around a L2 Cache Driver that provides
 * some handy methods for interacting with a remote cache ( redis, database, etc )
 */
export class RemoteCache {
  #driver: L2CacheDriver
  #logger: Logger
  #hasL1Backup: boolean
  #circuitBreaker?: CircuitBreaker
  #options: BentoCacheOptions

  constructor(
    driver: L2CacheDriver,
    logger: Logger,
    hasL1Backup: boolean,
    options: BentoCacheOptions,
  ) {
    this.#driver = driver
    this.#options = options
    this.#hasL1Backup = hasL1Backup
    this.#circuitBreaker = options.l2CircuitBreakerDuration
      ? new CircuitBreaker({ breakDuration: options.l2CircuitBreakerDuration })
      : undefined

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
    if (this.#circuitBreaker?.isOpen()) {
      this.#logger.error({ opId: options.id }, `circuit breaker is open. ignoring operation`)
      return fallbackValue
    }

    try {
      return await fn()
    } catch (error) {
      this.#logger.error({ error, opId: options.id }, `(${operation}) failed on remote cache`)

      this.#circuitBreaker?.open()

      /**
       * SuppressL2Errors is enabled automatically if undefined and we have a L1 backup
       * Otherwise, we need to check what the user set
       */
      if (
        (is.undefined(options.suppressL2Errors) && this.#hasL1Backup) ||
        options.suppressL2Errors
      ) {
        return fallbackValue
      }

      throw error
    }
  }

  /**
   * Get an item from the remote cache
   */
  async get(key: string, options: CacheEntryOptions) {
    return await this.#tryCacheOperation('get', options, undefined, async () => {
      const value = await this.#driver.get(key)
      if (value === undefined) return

      return CacheEntry.fromDriver(key, value, this.#options.serializer)
    })
  }

  /**
   * Set a new item in the remote cache
   */
  async set(key: string, value: string, options: CacheEntryOptions) {
    return await this.#tryCacheOperation('set', options, false, async () => {
      await this.#driver.set(key, value, options.getPhysicalTtl())
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
