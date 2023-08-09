import string from '@poppinss/utils/string'

import type { TTL } from './types/main.js'

/**
 * Resolve a TTL value to a number in milliseconds
 */
export function resolveTtl(ttl?: TTL, defaultTtl: TTL = 30_000) {
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

  if (typeof ttl === 'number') return ttl

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
