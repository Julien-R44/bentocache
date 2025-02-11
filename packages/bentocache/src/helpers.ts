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
 * Stolen from https://github.com/lukeed/hexoid/blob/main/src/index.js
 * Trying to avoid the dependency on hexoid as it publishes a dual-format package.
 */
let IDX = 256
const HEX: string[] = []
while (IDX--) HEX[IDX] = (IDX + 256).toString(16).substring(1)

export function hexoid(len?: number) {
  len = len || 16
  let str = ''
  let num = 0
  return function () {
    if (!str || num === 256) {
      str = ''
      num = ((1 + len) / 2) | 0
      while (num--) str += HEX[(256 * Math.random()) | 0]
      str = str.substring((num = 0), len - 2)
    }
    return str + HEX[num++]
  }
}
