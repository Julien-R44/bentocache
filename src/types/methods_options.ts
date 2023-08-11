import type { RawCommonOptions } from './main.js'

/**
 * Options accepted by the `getOrSet` method
 */
export type GetOrSetOptions = Pick<
  RawCommonOptions,
  'earlyExpiration' | 'gracefulRetain' | 'suppressRemoteCacheErrors' | 'lockTimeout'
>
