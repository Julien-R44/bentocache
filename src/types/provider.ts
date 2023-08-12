/*
 * @quakjs/bentocache
 *
 * (c) Quak
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import type { Factory } from './helpers.js'
import type { GetOrSetOptions, RawCommonOptions } from './main.js'

/**
 * A cache provider is a class that wraps an underlying cache driver
 * to provide additional features.
 */
export interface CacheProvider {
  /**
   * Set a value in the cache
   * Returns true if the value was set, false otherwise
   */
  set(key: string, value: any, options?: RawCommonOptions): Promise<boolean>

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
  getOrSet<T>(key: string, factory: Factory<T>, options?: Factory<T> | GetOrSetOptions): Promise<T>

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
