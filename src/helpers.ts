import is from '@sindresorhus/is'
import string from '@poppinss/utils/string'

import type { TTL } from './types/main.js'

/**
 * Resolve a TTL value to a number in milliseconds
 */
export function resolveTtl(ttl?: TTL, defaultTtl: TTL = 30_000) {
  if (is.nullOrUndefined(ttl)) {
    return is.number(defaultTtl) ? defaultTtl : string.milliseconds.parse(defaultTtl)
  }

  if (is.number(ttl)) return ttl

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
