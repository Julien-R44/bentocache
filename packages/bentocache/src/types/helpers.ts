/**
 * A Duration can be a number in milliseconds or a string formatted as a duration
 *
 * Formats accepted are :
 * - Simple number in milliseconds
 * - String formatted as a duration. Uses https://github.com/lukeed/ms under the hood
 */
export type Duration = number | string | null

/**
 * A factory is a function that returns a value or a promise of a value
 */
export type MaybePromise<T> = T | Promise<T>

/**
 * A Factory is basically just a function that returns a value
 */
export type Factory<T = any> = T | (() => T) | Promise<T> | (() => Promise<T>)

export type GetSetFactoryOptions = {
  /**
   * Set dynamically the TTL
   * See Adaptive caching documentation for more information
   */
  setTtl: (ttl: Duration) => void
}

/**
 * GetOrSet Factory
 */
export type GetSetFactory<T = any> = (options: GetSetFactoryOptions) => T | Promise<T>

/**
 * Logger interface
 */
export type { Logger } from 'typescript-log'
