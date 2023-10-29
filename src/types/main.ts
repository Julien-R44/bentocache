import type { CacheDriver } from './driver.js'
import type { BusDriver, BusOptions } from './bus.js'
import type { RawCommonOptions } from './options/options.js'

export * from './events.js'
export * from './helpers.js'
export * from './driver.js'
export * from './provider.js'
export * from './bus.js'
export * from './options/drivers_options.js'
export * from './options/methods_options.js'
export * from './options/options.js'

/**
 * A store entry passed to the BentoCache constructor
 */
export type StoreEntry = {
  driver: CreateDriverResult
} & RawCommonOptions & { prefix?: string }

export type CacheDriverEntryDefinition = {
  options: Record<string, any>
  factory: (config: any) => CacheDriver
}

/**
 * Contract for a cache driver factory
 */
export type CreateDriverResult = {
  l1: CacheDriverEntryDefinition
  l2?: CacheDriverEntryDefinition
  bus?: CreateBusDriverResult
}

/**
 * Contract for a bus driver factory
 */
export type CreateBusDriverResult = {
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
export type CacheStackDrivers = {
  localDriver?: CacheDriver
  remoteDriver?: CacheDriver
  busDriver?: BusDriver
  busOptions?: BusOptions
}
