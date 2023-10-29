import type { RawCommonOptions } from '../main.js'

/**
 * Options accepted by the `getOrSet` method
 */
export type GetOrSetOptions = Pick<
  RawCommonOptions,
  'earlyExpiration' | 'gracePeriod' | 'suppressRemoteCacheErrors' | 'lockTimeout' | 'ttl'
>
