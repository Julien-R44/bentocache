import { defu } from 'defu'
import type { GetOrSetOptions, RawCacheOptions } from './types/main.js'
import { resolveTtl } from './helpers.js'

export class CacheMethodOptions {
  options: RawCacheOptions

  logicalTtl: number
  physicalTtl: number
  earlyExpireTtl?: number

  constructor(options: RawCacheOptions = {}, defaults: Partial<RawCacheOptions> = {}) {
    this.options = defu(options, defaults)

    this.logicalTtl = this.#resolveLogicalTtl()
    this.physicalTtl = this.#resolvePhysicalTtl()
    this.earlyExpireTtl = this.#resolveEarlyExpireTtl()
  }

  #resolveEarlyExpireTtl() {
    const percentage = this.options.earlyExpiration

    if (!percentage) {
      return undefined
    }

    if (percentage <= 0 || percentage >= 1) {
      return undefined
    }

    return this.logicalTtl * percentage
  }

  cloneWith(options?: Partial<RawCacheOptions>) {
    return new CacheMethodOptions(options, this.options)
  }

  #resolveLogicalTtl() {
    return resolveTtl(this.options.ttl)
  }

  #resolvePhysicalTtl() {
    return this.isGracefulRetainEnabled
      ? resolveTtl(this.options.gracefulRetain!.duration)
      : this.logicalTtl
  }

  get isGracefulRetainEnabled() {
    return this.options.gracefulRetain?.enabled
  }

  get suppressRemoteCacheErrors() {
    return this.options.suppressRemoteCacheErrors
  }

  logicalTtlFromNow() {
    return Date.now() + this.logicalTtl
  }

  physicalTtlFromNow() {
    return Date.now() + this.physicalTtl
  }

  earlyExpireTtlFromNow() {
    if (!this.earlyExpireTtl) {
      return undefined
    }

    return Date.now() + this.earlyExpireTtl!
  }
}
