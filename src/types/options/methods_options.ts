/*
 * @blizzle/bentocache
 *
 * (c) Blizzle
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import type { RawCommonOptions } from '../main.js'

/**
 * Options accepted by the `getOrSet` method
 */
export type GetOrSetOptions = Pick<
  RawCommonOptions,
  'earlyExpiration' | 'gracePeriod' | 'suppressRemoteCacheErrors' | 'lockTimeout' | 'ttl'
>
