import { defu } from 'defu'
import type { GracefulRetainOptions, TTL } from './types/main.js'
import { GetOrSetOptions } from './types/main.js'
import { resolveTtl } from './helpers.js'

type Options = {
  ttl?: TTL
  gracefulRetain?: GracefulRetainOptions
  earlyExpiration?: number
}

export class CacheOptions {
  options: Options

  logicalTtl: number
  physicalTtl: number
  earlyExpireTtl?: number

  constructor(options: Options, defaults: Partial<Options> = {}) {
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
