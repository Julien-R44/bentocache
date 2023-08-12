/*
 * @quakjs/bentocache
 *
 * (c) Quak
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import type { CacheEvent } from '../../types/main.js'

/**
 * Event emitted when a cache entry is missed
 */
export class CacheMiss implements CacheEvent {
  name = 'cache:miss' as const

  constructor(
    readonly key: string,
    readonly store: string
  ) {}

  toJSON() {
    return {
      key: this.key,
      store: this.store,
    }
  }
}
