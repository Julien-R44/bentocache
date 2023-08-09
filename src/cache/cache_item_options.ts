import { uid } from 'uid'
import lodash from '@poppinss/utils/lodash'

import { resolveTtl } from '../helpers.js'
import type { RawCommonOptions } from '../types/main.js'

export class CacheItemOptions {
  /**
   * The options that were passed to the constructor
   */
  #options: RawCommonOptions

  /**
   * Unique identifier that will be used when logging
   * debug information.
   */
  id: string

  /**
   * Logical TTL is when the value is considered expired
   * but still can be in the cache ( Graceful retain )
   */
  logicalTtl?: number

  /**
   * Physical TTL is the time when value will be automatically
   * removed from the cache. This is the graceful retain
   * duration
   */
  physicalTtl?: number

  /**
   * Early expiration TTL is when the value should be
   * refreshed in the background.
   */
  earlyExpireTtl?: number

  /**
   * Timeouts for the cache operations
   */
  timeouts?: {
    soft?: number
    hard?: number
  }

  constructor(options: RawCommonOptions = {}, defaults: Partial<RawCommonOptions> = {}) {
    this.id = uid()

    this.#options = lodash.merge({}, defaults, options)
    this.logicalTtl = this.#resolveLogicalTtl()
    this.physicalTtl = this.#resolvePhysicalTtl()
    this.earlyExpireTtl = this.#resolveEarlyExpireTtl()
    this.timeouts = this.#resolveTimeouts()
  }

  /**
   * Resolve the timeouts to a duration in milliseconds
   */
  #resolveTimeouts() {
    const timeouts = this.#options.timeouts
    if (!timeouts) return undefined

    return {
      soft: resolveTtl(timeouts.soft, null),
      hard: resolveTtl(timeouts.hard, null),
    }
  }

  /**
   * Early expiration is received as a percentage of the
   * logical TTL. We need to convert it to a duration
   * in milliseconds.
   */
  #resolveEarlyExpireTtl() {
    const percentage = this.#options.earlyExpiration

    /**
     * Ignore invalid values
     */
    if (!percentage || percentage <= 0 || percentage >= 1) {
      return undefined
    }

    /**
     * If no logical ttl, that means value will never expire
     * So no early expiration
     */
    if (!this.logicalTtl) return undefined

    return this.logicalTtl * percentage
  }

  /**
   * Returns a new instance of `CacheItemOptions` with the same
   * options as the current instance, but with any provided
   * options overriding the current
   */
  cloneWith(options?: Partial<RawCommonOptions>) {
    return new CacheItemOptions(options, this.#options)
  }

  /**
   * Resolve the logical TTL to a duration in milliseconds
   */
  #resolveLogicalTtl() {
    return resolveTtl(this.#options.ttl)
  }

  /**
   * Resolve the physical TTL to a duration in milliseconds
   *
   * If graceful retain is not enabled then the physical TTL
   * is the same as the logical TTL
   */
  #resolvePhysicalTtl() {
    return this.isGracefulRetainEnabled
      ? resolveTtl(this.#options.gracefulRetain!.duration)
      : this.logicalTtl
  }

  get isGracefulRetainEnabled() {
    return this.#options.gracefulRetain?.enabled
  }

  get suppressRemoteCacheErrors() {
    return this.#options.suppressRemoteCacheErrors
  }

  /**
   * Compute the logical TTL timestamp from now
   */
  logicalTtlFromNow() {
    if (!this.logicalTtl) return undefined
    return Date.now() + this.logicalTtl
  }

  /**
   * Compute the physical TTL timestamp from now
   */
  physicalTtlFromNow() {
    if (!this.physicalTtl) return undefined
    return Date.now() + this.physicalTtl
  }

  /**
   * Compute the early expiration TTL timestamp from now
   */
  earlyExpireTtlFromNow() {
    if (!this.earlyExpireTtl) return undefined
    return Date.now() + this.earlyExpireTtl!
  }

  /**
   * Compute the lock timeout we should use for the
   * factory
   */
  factoryLockTimeout(hasFallbackValue: boolean) {
    if (!this.timeouts) return undefined

    /**
     * If graceful retain is enabled, we should use the soft timeout.
     * Because if the soft timeout is reached, we will
     * return the stale value.
     */
    if (hasFallbackValue && this.isGracefulRetainEnabled) {
      return this.timeouts.soft
    }

    return this.timeouts.hard
  }
}
