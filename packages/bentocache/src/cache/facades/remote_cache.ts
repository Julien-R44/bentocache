import { is } from '@julr/utils/is'

import { errors } from '../../errors.js'
import type { Logger } from '../../logger.js'
import type { L2CacheDriver } from '../../types/main.js'
import { CacheEntry } from '../cache_entry/cache_entry.js'
import { CircuitBreaker } from '../../circuit_breaker/index.js'
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

    this.#logger = logger.child({ layer: 'l2' })
  }

  #wrapInternalOperation<T>(fn: () => T): T {
    return this.#options.internalOperationWrapper
      ? this.#options.internalOperationWrapper(fn)
      : fn()
  }

  /**
   * Try to execute a cache operation and fallback to a default value
   * if the operation fails
   */
  async #tryCacheOperation<T, K>(
    operation: string,
    options: CacheEntryOptions,
    fallbackValue: K,
    fn: () => T,
  ): Promise<T | K> {
    if (this.#circuitBreaker?.isOpen()) {
      this.#logger.error({ opId: options.id }, `circuit breaker is open. ignoring operation`)
      return fallbackValue
    }

    try {
      return await this.#wrapInternalOperation(fn)
    } catch (err) {
      this.#logger.error({ err, opId: options.id }, `(${operation}) failed on remote cache`)

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

      throw new errors.E_L2_CACHE_ERROR(err)
    }
  }

  /**
   * Get an item from the remote cache
   */
  async get(key: string, options: CacheEntryOptions) {
    return await this.#tryCacheOperation('get', options, undefined, async () => {
      const value = await this.#driver.get(key)
      if (value === undefined) return

      const entry = CacheEntry.fromDriver(key, value, this.#options.serializer)
      const isGraced = entry.isLogicallyExpired()
      if (isGraced) {
        this.#logger.debug({ key, opId: options.id }, 'cache hit (graced)')
      } else {
        this.#logger.debug({ key, opId: options.id }, 'cache hit')
      }

      return { entry, isGraced }
    })
  }

  /**
   * Set a new item in the remote cache
   */
  async set(key: string, value: string, options: CacheEntryOptions) {
    return await this.#tryCacheOperation('set', options, false, async () => {
      this.#logger.debug({ key, opId: options.id }, 'saving item')
      await this.#driver.set(key, value, options.getPhysicalTtl())
      return true
    })
  }

  /**
   * Delete an item from the remote cache
   */
  async delete(key: string, options: CacheEntryOptions) {
    return await this.#tryCacheOperation('delete', options, false, async () => {
      this.#logger.debug({ key, opId: options.id }, 'deleting item')
      return await this.#driver.delete(key)
    })
  }

  /**
   * Delete multiple items from the remote cache
   */
  async deleteMany(keys: string[], options: CacheEntryOptions) {
    return await this.#tryCacheOperation('deleteMany', options, false, async () => {
      this.#logger.debug({ keys, opId: options.id }, 'deleting items')
      return await this.#driver.deleteMany(keys)
    })
  }

  /**
   * Make an item logically expire in the remote cache
   */
  async logicallyExpire(key: string, options: CacheEntryOptions) {
    return await this.#tryCacheOperation('logicallyExpire', options, false, async () => {
      this.#logger.debug({ key, opId: options.id }, 'logically expiring item')

      const value = await this.#driver.get(key)
      if (value === undefined) return

      const entry = CacheEntry.fromDriver(key, value, this.#options.serializer).expire().serialize()
      return await this.#driver.set(key, entry as any, options.getPhysicalTtl())
    })
  }

  /**
   * Create a new namespace for the remote cache
   */
  namespace(namespace: string) {
    return this.#driver.namespace(namespace) as L2CacheDriver
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
   * Manually prune expired cache entries
   */
  prune(): Promise<void> {
    return this.#driver.prune?.() ?? Promise.resolve()
  }

  /**
   * Disconnect from the remote cache
   */
  disconnect() {
    return this.#driver.disconnect()
  }
}
