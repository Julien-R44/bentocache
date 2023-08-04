import type { CacheEvent } from '../types/main.js'

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
