import type { CacheEvent } from '../types/main.js'

export class CacheDeleted implements CacheEvent {
  name = 'cache:deleted'

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
