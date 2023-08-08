import { uid } from 'uid'
import lodash from '@poppinss/utils/lodash'

import { resolveTtl } from './helpers.js'
import type { RawCacheOptions } from './types/main.js'

export class CacheItemOptions {
  options: RawCacheOptions

  logicalTtl?: number
  physicalTtl?: number
  earlyExpireTtl?: number

  id: string

  constructor(options: RawCacheOptions = {}, defaults: Partial<RawCacheOptions> = {}) {
    this.options = lodash.merge(defaults, options)

    this.logicalTtl = this.#resolveLogicalTtl()
    this.physicalTtl = this.#resolvePhysicalTtl()
    this.earlyExpireTtl = this.#resolveEarlyExpireTtl()

    this.id = uid()
  }

  #resolveEarlyExpireTtl() {
    const percentage = this.options.earlyExpiration

    if (!percentage) {
      return undefined
    }

    if (percentage <= 0 || percentage >= 1) {
      return undefined
    }

    if (!this.logicalTtl) {
      return undefined
    }

    return this.logicalTtl * percentage
  }

  cloneWith(options?: Partial<RawCacheOptions>) {
    return new CacheItemOptions(options, this.options)
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
    if (!this.logicalTtl) {
      return undefined
    }

    return Date.now() + this.logicalTtl
  }

  physicalTtlFromNow() {
    if (!this.physicalTtl) {
      return undefined
    }

    return Date.now() + this.physicalTtl
  }

  earlyExpireTtlFromNow() {
    if (!this.earlyExpireTtl) {
      return undefined
    }

    return Date.now() + this.earlyExpireTtl!
  }
}
