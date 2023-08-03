import type { CacheEvent } from '../types/main.js'

export class CacheCleared implements CacheEvent {
  name = 'cache:cleared'

  constructor(readonly store: string) {}

  toJSON() {
    return {
      store: this.store,
    }
  }
}
