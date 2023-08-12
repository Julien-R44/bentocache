/*
 * @quakjs/bentocache
 *
 * (c) Quak
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import type { Duration, Emitter, Logger } from '../main.js'

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
  ttl?: Duration
  gracePeriod?: GracePeriodOptions
  earlyExpiration?: number
  suppressRemoteCacheErrors?: boolean
  timeouts?: FactoryTimeoutOptions
  lockTimeout?: Duration
}

/**
 * Options accepted by Bentocache
 */
export type RawBentoCacheOptions = {
  logger?: Logger
  emitter?: Emitter
  prefix?: string
} & RawCommonOptions

/**
 * The options that can be passed when creating
 * a cache driver like `memoryDriver({ ... })
 */
export type CacheDriverOptions = {
  prefix?: string
} & RawCommonOptions
