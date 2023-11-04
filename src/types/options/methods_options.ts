import type { RawCommonOptions } from '../main.js'

/**
 * Options accepted by the `getOrSet` method
 */
export type GetOrSetOptions = Pick<
  RawCommonOptions,
  'earlyExpiration' | 'gracePeriod' | 'suppressL2Errors' | 'lockTimeout' | 'ttl' | 'timeouts'
>

/**
 * Options accepted by the `set` method
 */
export type SetOptions = GetOrSetOptions

/**
 * Options accepted by the `get` method
 */
export type GetOptions = Pick<
  RawCommonOptions,
  'earlyExpiration' | 'gracePeriod' | 'suppressL2Errors' | 'ttl'
>

/**
 * Options accepted by the `delete` method
 */
export type DeleteOptions = Pick<RawCommonOptions, 'suppressL2Errors'>
