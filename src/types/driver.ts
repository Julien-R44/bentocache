import type { MaybePromise } from './helpers.js'
import type { KeyValueObject } from './main.js'

export interface CacheDriver {
  /**
   * Returns a new instance of the driver namespaced
   */
  namespace(namespace: string): CacheDriver

  /**
   * Get a value from the cache
   */
  get(key: string): MaybePromise<string | undefined>

  /**
   * Get many values from the cache
   * Will return an array of objects with `key` and `value` properties
   * If a value is not found, `value` will be undefined
   */
  getMany(keys: string[]): MaybePromise<KeyValueObject<any>[]>

  /**
   * Get the value of a key and delete it
   *
   * Returns the value if the key exists, undefined otherwise
   */
  pull(key: string): MaybePromise<string | undefined>

  /**
   * Put a value in the cache.
   * If `ttl` is not defined, the value will be stored forever
   * Returns true if the value was set, false otherwise
   */
  set(key: string, value: string, ttl?: number): MaybePromise<boolean>

  /**
   * Set many values in the cache
   * If `ttl` is not defined, the value will be stored forever
   */
  setMany(values: KeyValueObject<any>[], ttl?: number): MaybePromise<boolean>

  /**
   * Check if a key exists in the cache
   */
  has(key: string): MaybePromise<boolean>

  /**
   * Remove all items from the cache
   */
  clear(): MaybePromise<void>

  /**
   * Delete a key from the cache
   * Returns true if the key was deleted, false otherwise
   */
  delete(key: string): MaybePromise<boolean>

  /**
   * Delete multiple keys from the cache
   */
  deleteMany(keys: string[]): MaybePromise<boolean>

  /**
   * Closes the connection to the cache.
   * Some drivers may not need this
   */
  disconnect(): MaybePromise<void>
}
