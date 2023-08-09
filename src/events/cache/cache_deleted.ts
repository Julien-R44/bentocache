import type { CacheEvent } from '../../types/main.js'

/**
 * Event emitted when a cache entry is deleted
 * using `.delete()` or `.deleteMany()`
 */
export class CacheDeleted implements CacheEvent {
  name = 'cache:deleted' as const

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
