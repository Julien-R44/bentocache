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
   *
   * @deprecated use `setOptions` instead
   */
  setTtl: (ttl: Duration) => void

  /**
   * Set the options for the current factory
   */
  setOptions: (options: { ttl?: Duration; skipBusNotify?: boolean; skipL2Write?: boolean }) => void

  /**
   * Set the tags for the current factory
   */
  setTags: (tags: string[]) => void

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

  /**
   * Graced entry if available
   */
  gracedEntry: { value: any } | undefined
}

/**
 * GetOrSet Factory
 */
export type GetSetFactory<T = any> = (options: GetSetFactoryContext) => T | Promise<T>

/**
 * Logger interface
 */
export type { Logger } from '@julr/utils/logger'
