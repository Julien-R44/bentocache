/*
 * @blizzle/bentocache
 *
 * (c) Blizzle
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import type { CacheEvent } from '../../types/main.js'

/**
 * Event emitted when a cache entry is written
 * using `set`,`getOrSet`
 */
export class CacheWritten implements CacheEvent {
  name = 'cache:written' as const

  constructor(
    readonly key: string,
    readonly value: any,
    readonly store: string
  ) {}

  toJSON() {
    return {
      key: this.key,
      store: this.store,
      value: this.value,
    }
  }
}
