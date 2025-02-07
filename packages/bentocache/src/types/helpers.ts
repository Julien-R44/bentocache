/**
 * A Duration can be a number in milliseconds or a string formatted as a duration
 *
 * Formats accepted are :
 * - Simple number in milliseconds
 * - String formatted as a duration. Uses https://github.com/lukeed/ms under the hood
 */
export type Duration = number | string | null

/**
 * A Factory is basically just a function that returns a value
 */
export type Factory<T = any> = T | (() => T) | Promise<T> | (() => Promise<T>)

export type GetSetFactoryContext = {
  /**
   * Dynamically set the TTL
   * @see https://bentocache.dev/docs/adaptive-caching
   */
  setTtl: (ttl: Duration) => void

  /**
   * Make the factory fail with a custom error.
   * Nothing will be cached and if a graced value is available, it will be returned
   */
  fail: (message?: string) => void

  /**
   * Make the factory do not cache anything. **If a graced value is available,
   * it will not be used**
   */
  skip: () => undefined
}

/**
 * GetOrSet Factory
 */
export type GetSetFactory<T = any> = (options: GetSetFactoryContext) => T | Promise<T>

/**
 * Logger interface
 */
export type { Logger } from '@julr/utils/logger'
