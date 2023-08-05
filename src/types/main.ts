/*
 * @adonisjs/cache
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import type { CacheDriver } from './driver.js'
import type { CachedValue, MaybePromise, TTL } from './helpers.js'

export * from './events.js'
export * from './options.js'
export * from './helpers.js'
export * from './driver.js'
export * from './provider.js'

export type Factory = () => MaybePromise<CachedValue>

export type GracefulRetainOptions = {
  enabled: boolean
  duration?: TTL
  delay?: TTL
}

export type GetOrSetOptions = {
  gracefulRetain?: GracefulRetainOptions
  earlyExpiration?: number
}

export type CacheDriverFactory = (config: any) => CacheDriver

export type CacheDriverOptions = {
  ttl?: TTL
  prefix?: string
}

export type CreateDriverResult =
  | {
      type: 'driver'
      options: CacheDriverOptions
      driver: CacheDriverFactory
    }
  | {
      type: 'hybrid'
      local: Exclude<CreateDriverResult, { type: 'hybrid' }>
      remote: Exclude<CreateDriverResult, { type: 'hybrid' }>
    }

export interface CacheSerializer {
  serialize: (value: any) => Promise<string> | string
  deserialize: (value: any) => Promise<any> | any
}
