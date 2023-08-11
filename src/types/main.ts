import type { BusDriver, BusOptions } from './bus.js'
import type { CacheDriver } from './driver.js'
import type { Emitter } from './events.js'
import type { Logger, TTL } from './helpers.js'

export * from './events.js'
export * from './options.js'
export * from './helpers.js'
export * from './driver.js'
export * from './provider.js'
export * from './bus.js'
export * from './methods_options.js'

export type RawBentoCacheOptions = {
  logger?: Logger
  emitter?: Emitter
  prefix?: string
} & RawCommonOptions

export type CacheProviderOptions = {
  localDriver?: CacheDriver
  remoteDriver?: CacheDriver
  busDriver?: BusDriver
  logger: Logger
  emitter: Emitter
  ttl: number
  gracePeriod: GracePeriodOptions
  earlyExpiration: number
  suppressRemoteCacheErrors: boolean
  timeouts?: FactoryTimeoutOptions
}

export type RawCommonOptions = {
  ttl?: TTL
  gracePeriod?: GracePeriodOptions
  earlyExpiration?: number
  suppressRemoteCacheErrors?: boolean
  timeouts?: FactoryTimeoutOptions
  lockTimeout?: TTL
}

/**
 * The options that can be passed when creating
 * a cache driver like `memoryDriver({ ... })
 */
export type CacheDriverOptions = {
  ttl?: TTL
  prefix?: string
}

export type FactoryTimeoutOptions = {
  soft?: TTL
  hard?: TTL
}

export type GracePeriodOptions = {
  /**
   * Whether to enable grace period
   */
  enabled: boolean

  /**
   * The duration for which entry could still be
   * served after the TTL has expired
   */
  duration?: TTL

  /**
   * The duration for which the entry will be
   * reconsidered valid after a failed refresh
   */
  fallbackDuration?: TTL
}

export type CacheDriverFactory = (config: any) => CacheDriver

export type CreateDriverResult = {
  local: {
    options: CacheDriverOptions
    factory: CacheDriverFactory
  }
  remote?: {
    options: CacheDriverOptions
    factory: CacheDriverFactory
  }
  bus?: CreateBusDriverResult
}

export type CacheBusFactory = (config: any) => BusDriver

export type CreateBusDriverResult = {
  options: BusOptions
  factory: CacheBusFactory
}

export interface CacheSerializer {
  serialize: (value: any) => string
  deserialize: (value: any) => any
}
