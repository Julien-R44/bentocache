import string from '@poppinss/utils/string'

import type { Duration } from './types/main.js'

/**
 * Resolve a TTL value to a number in milliseconds
 */
export function resolveTtl(ttl?: Duration, defaultTtl: Duration = 30_000) {
  if (typeof ttl === 'number') return ttl

  /**
   * If the TTL is null, it means the value should never expire
   */
  if (ttl === null) {
    return undefined
  }

  if (ttl === undefined) {
    if (typeof defaultTtl === 'number') return defaultTtl
    if (typeof defaultTtl === 'string') return string.milliseconds.parse(defaultTtl)

    return undefined
  }

  return string.milliseconds.parse(ttl)
}

/**
 * Useful for creating a return value that can be destructured
 * or iterated over.
 *
 * See : https://antfu.me/posts/destructuring-with-object-or-array
 */
export function createIsomorphicDestructurable<
  T extends Record<string, unknown>,
  A extends readonly any[],
>(obj: T, arr: A): T & A {
  const clone = { ...obj }

  Object.defineProperty(clone, Symbol.iterator, {
    enumerable: false,
    value() {
      let index = 0
      return {
        next: () => ({
          value: arr[index++],
          done: index > arr.length,
        }),
      }
    },
  })

  return clone as T & A
}

/**
 * Resolve a promise and return the error/result as a tuple
 */
export function to<T, U = Error>(
  promise: Promise<T>,
  errorExt?: object
): Promise<[U, undefined] | [null, T]> {
  return promise
    .then<[null, T]>((data: T) => [null, data])
    .catch<[U, undefined]>((err: U) => {
      if (errorExt) {
        const parsedError = Object.assign({}, err, errorExt)
        return [parsedError, undefined]
      }

      return [err, undefined]
    })
}
