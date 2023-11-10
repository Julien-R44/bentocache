import type { Factory } from './helpers.js'
import type {
  ClearOptions,
  DeleteOptions,
  GetOptions,
  GetOrSetOptions,
  HasOptions,
  SetOptions,
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
  set(key: string, value: any, options?: SetOptions): Promise<boolean>

  /**
   * Set a value in the cache forever
   */
  setForever(key: string, value: any, options?: SetOptions): Promise<boolean>

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
  get<T = any>(key: string, defaultValue?: Factory<T>, options?: GetOptions): Promise<T>

  /**
   * Get or set a value in the cache
   */
  getOrSet<T>(key: string, cb: Factory<T>, opts?: GetOrSetOptions): Promise<T>
  getOrSet<T>(key: string, factory: Factory<T>, options?: Factory<T> | GetOrSetOptions): Promise<T>

  /**
   * Get or set a value in the cache forever
   */
  getOrSetForever<T>(key: string, cb: Factory<T>, opts?: GetOrSetOptions): Promise<T>

  /**
   * Check if a key is missing from the cache
   */
  missing(key: string): Promise<boolean>

  /**
   * Returns a new instance of the driver namespaced
   */
  namespace(namespace: string): CacheProvider

  /**
   * Check if a key exists in the cache
   */
  has(key: string, options?: HasOptions): Promise<boolean>

  /**
   * Get the value of a key and delete it
   *
   * Returns the value if the key exists, undefined otherwise
   */
  pull<T = any>(key: string): Promise<T | undefined | null>

  /**
   * Delete a key from the cache
   * Returns true if the key was deleted, false otherwise
   */
  delete(key: string, options?: DeleteOptions): Promise<boolean>

  /**
   * Delete multiple keys from the cache
   */
  deleteMany(keys: string[], options?: DeleteOptions): Promise<boolean>

  /**
   * Remove all items from the cache
   */
  clear(options?: ClearOptions): Promise<void>

  /**
   * Closes the connection to the cache
   */
  disconnect(): Promise<void>
}
