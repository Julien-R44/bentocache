import type { CacheDriver } from './driver.js'
import type { Factory, Logger, TTL } from './helpers.js'
import type {
  BusDriver,
  CacheSerializer,
  Emitter,
  GetOrSetOptions,
  GracefulRetainOptions,
  RawCacheOptions,
} from './main.js'

/**
 * A cache provider is a class that wraps an underlying cache driver
 * to provide additional features.
 */
export interface CacheProvider {
  /**
   * Set a value in the cache
   * Returns true if the value was set, false otherwise
   */
  set(key: string, value: any, options?: RawCacheOptions): Promise<boolean>

  /**
   * Set a value in the cache forever
   */
  setForever(key: string, value: any): Promise<boolean>

  /**
   * Get a value from the cache
   *
   * @param key Key to get
   */
  get<T>(key: string): Promise<T | undefined | null>

  /**
   * Get a value from the cache, fallback to a default value
   *
   * @param key Key to get
   * @param defaultValue Default value if the key is not found
   */
  get<T>(key: string, defaultValue?: Factory<T>): Promise<T>

  /**
   * Get a value from the cache, fallback to a default value
   * and set options
   *
   * @param key  Key to get
   * @param defaultValue Default value if the key is not found
   * @param options Options to set
   */
  get<T = any>(key: string, defaultValue?: Factory<T>, options?: GetOrSetOptions): Promise<T>

  /**
   * Get or set a value in the cache
   */
  getOrSet<T>(key: string, cb: Factory<T>, opts?: GetOrSetOptions): Promise<T>

  /**
   * Get or set a value in the cache with a specific TTL
   */
  getOrSet<T>(key: string, ttl: TTL, cb: Factory<T>, opts?: GetOrSetOptions): Promise<T>

  getOrSet<T>(
    key: string,
    ttlOrFactory: TTL | Factory<T>,
    factoryOrOptions?: Factory<T> | GetOrSetOptions,
    maybeOptions?: GetOrSetOptions
  ): Promise<T>

  /**
   * Get or set a value in the cache forever
   */
  getOrSetForever<T>(key: string, cb: Factory<T>, opts?: GetOrSetOptions): Promise<T>

  /**
   * Check if a key is missing from the cache
   */
  missing(key: string): Promise<boolean>

  namespace(namespace: string): CacheProvider
  has(key: string): Promise<boolean>
  pull<T = any>(key: string): Promise<T | undefined | null>
  delete(key: string): Promise<boolean>
  deleteMany(keys: string[]): Promise<boolean>
  clear(): Promise<void>
  disconnect(): Promise<void>
}

export type CacheProviderOptions = {
  mode?: 'hybrid' | 'basic'
  localDriver?: CacheDriver
  remoteDriver?: CacheDriver
  busDriver?: BusDriver
  emitter: Emitter
  logger: Logger
  ttl?: TTL
  serializer?: CacheSerializer
  gracefulRetain: GracefulRetainOptions
  earlyExpiration?: number
}
