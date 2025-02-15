import type { FactoryError } from '../../errors.js'
import type { CacheSerializer, Duration, Emitter, Logger } from '../main.js'

/**
 * These options are common to :
 * - BentoCache global options
 * - Driver options
 * - Core methods
 */
export type RawCommonOptions = {
  /**
   * The soft timeout. Once this timeout is reached,
   * the factory will try to return a graced value
   * if available
   *
   * @default 0 Means, if a graced value is available, it will be returned
   * immediately and the factory will be refreshed in the background
   */
  timeout?: Duration

  /**
   * The hard timeout. Once this timeout is reached,
   * the factory will just throw an error that will
   * bubble up. You will need to handle this error
   *
   * @default null Means, no hard timeout
   */
  hardTimeout?: Duration

  /**
   * The duration for which the entry will be
   * considered valid
   */
  ttl?: Duration

  /**
   * Grace period options
   */
  grace?: false | Duration
  graceBackoff?: Duration

  /**
   * Whether to suppress errors that occur when
   * trying to fetch from remote (l2) cache
   */
  suppressL2Errors?: boolean

  /**
   * Maximum time for which a lock can try to be acquired
   * before running a factory
   */
  lockTimeout?: Duration

  /**
   * A handler that will be called when a factory
   * throws an error
   */
  onFactoryError?: (error: FactoryError) => void

  /**
   * Should the cache entry be written to the L2 cache
   * @default false
   */
  skipL2Write?: boolean

  /**
   * Should the bus be used for cache invalidation
   * @default false
   */
  skipBusNotify?: boolean

  /**
   * Duration for the circuit breaker to stay open
   * if l2 cache fails
   *
   * @default null Means, no circuit breaker
   */
  l2CircuitBreakerDuration?: Duration

  /**
   * Tags that will be associated with the cache entry
   */
  tags?: string[]
}

/**
 * Options accepted by Bentocache
 */
export type RawBentoCacheOptions = {
  prefix?: string

  /**
   * A logger instance that will be used to log
   * multiple events occurring in the cache
   *
   * Pino is compatible out of the box
   */
  logger?: Logger

  /**
   * An emitter instance that will be used to
   * emit multiple events occurring in the cache
   *
   * Emittery and node EventEmitter are compatible
   * out of the box
   */
  emitter?: Emitter

  /**
   * Custom serializer
   */
  serializer?: CacheSerializer
} & RawCommonOptions

/**
 * The options that can be passed when creating
 * a cache driver like `memoryDriver({ ... })
 */
export type CacheDriverOptions = {
  prefix?: string
} & RawCommonOptions
