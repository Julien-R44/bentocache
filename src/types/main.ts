import type { CacheDriver } from './driver.js'
import type { BentoCache } from '../bento_cache.js'
import type { BusDriver, BusOptions } from './bus.js'

export * from './bus.js'
export * from './events.js'
export * from './driver.js'
export * from './helpers.js'
export * from './provider.js'
export * from './options/options.js'
export * from './options/drivers_options.js'
export * from './options/methods_options.js'

/**
 * Interface for a L1 cache driver. Probably a memory driver
 */
export interface L1CacheDriver extends CacheDriver<false> {
  type: 'l1'
}

/**
 * Interface for a L2, distributed cache driver.
 */
export interface L2CacheDriver extends CacheDriver<true> {
  type: 'l2'
}

/**
 * Factory result for a cache driver
 */
export interface CreateDriverResult<T extends L1CacheDriver | L2CacheDriver> {
  options: Record<string, any>
  factory: (config: any) => T
}

/**
 * Contract for a bus driver factory
 */
export interface CreateBusDriverResult {
  options: BusOptions
  factory: (config: any) => BusDriver
}

/**
 * Cache serializer contract
 */
export interface CacheSerializer {
  serialize: (value: any) => string
  deserialize: (value: any) => any
}

/**
 * Stack of cache drivers
 */
export interface CacheStackDrivers {
  l1Driver?: CacheDriver<false>
  l2Driver?: CacheDriver<true>
  busDriver?: BusDriver
  busOptions?: BusOptions
}

/**
 * A Bentocache Plugin
 */
export interface BentoCachePlugin {
  register(bentocache: BentoCache<any>): void
}
