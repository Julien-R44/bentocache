import is from '@sindresorhus/is'
import string from '@poppinss/utils/string'

import type { TTL } from './types/main.js'

/**
 * Resolve a TTL value to a number in milliseconds
 */
export function resolveTtl(ttl?: TTL, defaultTtl = 30000) {
  if (is.nullOrUndefined(ttl)) return defaultTtl
  if (is.number(ttl)) return ttl

  return string.milliseconds.parse(ttl)
}
