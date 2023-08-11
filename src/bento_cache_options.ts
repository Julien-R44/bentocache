import EventEmitter from 'node:events'
import { noopLogger } from 'typescript-log'

import { resolveTtl } from './helpers.js'
import type {
  Emitter,
  FactoryTimeoutOptions,
  GracePeriodOptions as GracePeriodOptions,
  Logger,
  RawBentoCacheOptions,
} from './types/main.js'

/**
 * The default options to use throughout the library
 *
 * Some of them can be override on a per-cache basis
 * or on a per-operation basis
 */
export class BentoCacheOptions {
  /**
   * The default TTL for all caches
   *
   * @default 30m
   */
  ttl: number

  /**
   * Default prefix for all caches
   */
  prefix?: string

  /**
   * The grace period options
   */
  gracePeriod: GracePeriodOptions

  /**
   * Default early expiration percentage
   */
  earlyExpiration: number

  /**
   * Whether to suppress remote cache errors
   */
  suppressRemoteCacheErrors: boolean

  /**
   * The soft and hard timeouts for the factories
   */
  timeouts?: FactoryTimeoutOptions

  /**
   * The logger used throughout the library
   */
  logger: Logger

  /**
   * The emitter used throughout the library
   */
  emitter: Emitter

  /**
   * Max time to wait for the lock to be acquired
   */
  lockTimeout?: number

  constructor(options: RawBentoCacheOptions) {
    this.prefix = options.prefix
    this.ttl = resolveTtl(options.ttl, '30m')!

    this.timeouts = options.timeouts
    this.earlyExpiration = options.earlyExpiration || 0
    this.suppressRemoteCacheErrors = options.suppressRemoteCacheErrors || true
    this.lockTimeout = resolveTtl(options.lockTimeout, null)
    this.gracePeriod = options.gracePeriod || {
      enabled: false,
      duration: '6h',
      fallbackDuration: '10s',
    }

    this.emitter = options.emitter || new EventEmitter()
    this.logger = (options.logger || noopLogger()).child({ pkg: 'bentocache' })
  }
}
