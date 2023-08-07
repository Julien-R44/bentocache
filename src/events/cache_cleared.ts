import type { CacheEvent } from '../types/main.js'

/**
 * Event emitted when a cache store is cleared
 * using `.clear()`
 */
export class CacheCleared implements CacheEvent {
  name = 'cache:cleared' as const

  constructor(readonly store: string) {}

  toJSON() {
    return {
      store: this.store,
    }
  }
}
