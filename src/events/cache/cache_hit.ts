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
 * Event emitted when a cache entry is hit
 */
export class CacheHit implements CacheEvent {
  name = 'cache:hit' as const

  constructor(
    readonly key: string,
    readonly value: any,
    readonly store: string,
    readonly graced: boolean = false
  ) {}

  toJSON() {
    return {
      key: this.key,
      value: this.value,
      store: this.store,
      graced: this.graced,
    }
  }
}
