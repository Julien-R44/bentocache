/*
 * @adonisjs/cache
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import type { BusDriver } from './bus.js'
import type { CacheDriver } from './driver.js'
import type { TTL } from './helpers.js'

export * from './events.js'
export * from './options.js'
export * from './helpers.js'
export * from './driver.js'
export * from './provider.js'
export * from './bus.js'

export type FactoryTimeoutOptions = {
  soft?: TTL
  hard?: TTL
}

export type RawCacheOptions = {
  ttl?: TTL
  gracefulRetain?: GracefulRetainOptions
  earlyExpiration?: number
  suppressRemoteCacheErrors?: boolean
  timeouts?: FactoryTimeoutOptions
}

export type GracefulRetainOptions = {
  enabled: boolean
  duration?: TTL
  delay?: TTL
}

export type GetOrSetOptions = Pick<
  RawCacheOptions,
  'earlyExpiration' | 'gracefulRetain' | 'suppressRemoteCacheErrors'
>

export type CacheDriverFactory = (config: any) => CacheDriver

export type CacheDriverOptions = {
  ttl?: TTL
  prefix?: string
}

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

export type CacheBusOptions = {
  //
}

export type CacheBusFactory = (config: any) => BusDriver

export type CreateBusDriverResult = {
  options: CacheBusOptions
  factory: CacheBusFactory
}

export interface CacheSerializer {
  serialize: (value: any) => string
  deserialize: (value: any) => any
}
