import { hexoid } from 'hexoid'
import { is } from '@julr/utils/is'

import { errors } from '../../errors.js'
import { resolveTtl } from '../../helpers.js'
import type { Duration, RawCommonOptions } from '../../types/main.js'

const toId = hexoid(12)

export class CacheEntryOptions {
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
   * but still can be in the cache ( Grace period )
   */
  logicalTtl?: number

  /**
   * Physical TTL is the time when value will be automatically
   * removed from the cache. This is the Grace period
   * duration
   */
  physicalTtl?: number

  /**
   * Timeouts for the cache operations
   */
  timeout?: number
  hardTimeout?: number

  /**
   * Resolved grace period options
   */
  grace: number
  graceBackoff: number

  /**
   * Max time to wait for the lock to be acquired
   */
  lockTimeout?: number

  constructor(options: RawCommonOptions = {}, defaults: Partial<RawCommonOptions> = {}) {
    this.id = toId()

    this.#options = { ...defaults, ...options }

    this.grace = this.#resolveGrace()
    this.graceBackoff = resolveTtl(this.#options.graceBackoff, null) ?? 0
    this.logicalTtl = this.#resolveLogicalTtl()
    this.physicalTtl = this.#resolvePhysicalTtl()
    this.timeout = resolveTtl(this.#options.timeout, null)
    this.hardTimeout = resolveTtl(this.#options.hardTimeout, null)
    this.lockTimeout = resolveTtl(this.#options.lockTimeout, null)
  }

  /**
   * Resolve the grace period options
   */
  #resolveGrace() {
    if (this.#options.grace === false) return 0
    return resolveTtl(this.#options.grace, null) ?? 0
  }

  /**
   * Returns a new instance of `CacheItemOptions` with the same
   * options as the current instance, but with any provided
   * options overriding the current
   *
   * For performance reasons, if no options are provided, the
   * current instance is returned
   */
  cloneWith(options?: Partial<RawCommonOptions>) {
    return options ? new CacheEntryOptions(options, this.#options) : this
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
   * If grace period is not enabled then the physical TTL
   * is the same as the logical TTL
   */
  #resolvePhysicalTtl() {
    return this.isGraceEnabled ? this.grace : this.logicalTtl
  }

  get isGraceEnabled() {
    return this.grace > 0
  }

  get suppressL2Errors() {
    return this.#options.suppressL2Errors
  }

  /**
   * Set a new logical TTL
   */
  setLogicalTtl(ttl: Duration) {
    this.#options.ttl = ttl

    this.logicalTtl = this.#resolveLogicalTtl()
    this.physicalTtl = this.#resolvePhysicalTtl()

    return this
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
   * Compute the lock timeout we should use for the
   * factory
   */
  factoryTimeout(hasFallbackValue: boolean) {
    if (hasFallbackValue && this.isGraceEnabled && is.number(this.timeout)) {
      return {
        type: 'soft',
        duration: this.timeout,
        exception: errors.E_FACTORY_SOFT_TIMEOUT,
      }
    }

    if (this.hardTimeout) {
      return {
        type: 'hard',
        duration: this.hardTimeout,
        exception: errors.E_FACTORY_HARD_TIMEOUT,
      }
    }

    return
  }

  /**
   * Determine if we should use the SWR strategy
   */
  shouldSwr(hasFallback: boolean) {
    return this.isGraceEnabled && this.timeout === 0 && hasFallback
  }

  /**
   * Compute the maximum time we should wait for the
   * lock to be acquired
   */
  getApplicableLockTimeout(hasFallbackValue: boolean) {
    if (this.lockTimeout) {
      return this.lockTimeout
    }

    /**
     * If we have a fallback value and grace period is enabled,
     * that means we should wait at most for the soft timeout
     * duration.
     */
    if (hasFallbackValue && this.isGraceEnabled && typeof this.timeout === 'number') {
      return this.timeout
    }
  }
}
