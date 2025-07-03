import type {
  ClearOptions,
  DeleteManyOptions,
  DeleteOptions,
  GetOrSetForeverOptions,
  GetOrSetOptions,
  GetOptions,
  HasOptions,
  SetOptions,
  ExpireByTagOptions,
  DeleteByTagOptions,
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
  set(options: SetOptions): Promise<boolean>

  /**
   * Set a value in the cache forever
   */
  setForever(options: SetOptions): Promise<boolean>

  /**
   * Get a value from the cache, fallback to a default value
   * and set options
   */
  get<T = any>(options: GetOptions<T>): Promise<T>

  /**
   * Get or set a value in the cache
   */
  getOrSet<T>(options: GetOrSetOptions<T>): Promise<T>

  /**
   * Get or set a value in the cache forever
   */
  getOrSetForever<T>(options: GetOrSetForeverOptions<T>): Promise<T>

  /**
   * Check if a key exists in the cache
   */
  has(options: HasOptions): Promise<boolean>

  /**
   * Check if a key is missing from the cache
   */
  missing(options: HasOptions): Promise<boolean>

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
  delete(options: DeleteOptions): Promise<boolean>

  /**
   * Delete multiple keys from the cache
   */
  deleteMany(options: DeleteManyOptions): Promise<boolean>

  /**
   * Expire all keys with a specific tag
   */
  expireByTag(options: ExpireByTagOptions): Promise<boolean>

  /**
   * Delete all keys with specific tags
   */
  deleteByTag(options: DeleteByTagOptions): Promise<boolean>

  /**
   * Expire a key from the cache.
   * Entry will not be fully deleted but expired and
   * retained for the grace period if enabled.
   */
  expire(options: DeleteOptions): Promise<boolean>

  /**
   * Remove all items from the cache
   */
  clear(options?: ClearOptions): Promise<void>

  /**
   * Returns a new instance of the driver namespaced
   */
  namespace(namespace: string): CacheProvider

  /**
   * Closes the connection to the cache
   */
  disconnect(): Promise<void>
}
