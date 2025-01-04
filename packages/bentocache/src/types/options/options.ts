import type { CacheSerializer, Duration, Emitter, Logger } from '../main.js'

/**
 * Options for factory timeouts
 */
export type FactoryTimeoutOptions = {
  /**
   * The soft timeout. Once this timeout is reached,
   * the factory will try to return a graced value
   * if available
   */
  soft?: Duration

  /**
   * The hard timeout. Once this timeout is reached,
   * the factory will just throw an error that will
   * bubble up. You will need to handle this error
   */
  hard?: Duration
}

/**
 * Options for Grace periods
 */
export type GracePeriodOptions = {
  /**
   * Whether to enable grace period
   */
  enabled: boolean

  /**
   * The duration for which entry could still be
   * served after the TTL has expired
   */
  duration?: Duration

  /**
   * The duration for which the entry will be
   * reconsidered valid after a failed refresh
   */
  fallbackDuration?: Duration
}

/**
 * These options are common to :
 * - BentoCache global options
 * - Driver options
 * - Core methods
 */
export type RawCommonOptions = {
  timeouts?: FactoryTimeoutOptions

  /**
   * The duration for which the entry will be
   * considered valid
   */
  ttl?: Duration

  /**
   * Grace period options
   */
  gracePeriod?: GracePeriodOptions

  /**
   * A percentage of the TTL that will be used
   * as a threshold for an early refresh
   */
  earlyExpiration?: number

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
   * Custom serialiser
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
