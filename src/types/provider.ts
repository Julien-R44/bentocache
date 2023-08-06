import type { CacheDriver } from './driver.js'
import type { TTL } from './helpers.js'
import type {
  CacheSerializer,
  Emitter,
  Factory,
  GetOrSetOptions,
  GracefulRetainOptions,
} from './main.js'

/**
 * A cache provider is a class that wraps an underlying cache driver
 * to provide additional features.
 */
export interface CacheProvider extends CacheDriver {
  /**
   * Set a value in the cache forever
   */
  setForever(key: string, value: string): Promise<boolean>

  /**
   * Get or set a value in the cache
   */
  getOrSet(key: string, cb: Factory, opts?: GetOrSetOptions): Promise<any>

  /**
   * Get or set a value in the cache with a specific TTL
   */
  getOrSet(key: string, ttl: TTL, cb: Factory, opts?: GetOrSetOptions): Promise<any>

  /**
   * Get or set a value in the cache forever
   */
  getOrSetForever(key: string, cb: Factory, opts?: GetOrSetOptions): Promise<any>

  /**
   * Check if a key is missing from the cache
   */
  missing(key: string): Promise<boolean>
}

export type CacheProviderOptions = {
  mode?: 'hybrid' | 'basic'
  localDriver: CacheDriver
  remoteDriver?: CacheDriver
  busDriver?: any
  emitter?: Emitter
  ttl?: TTL
  serializer?: CacheSerializer
  gracefulRetain: GracefulRetainOptions
  earlyExpiration?: number
}

export interface CacheProviderConstructor {
  // todo any
  new (name: string, driver: CacheDriver, options: CacheProviderOptions): CacheProvider
}
