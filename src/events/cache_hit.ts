import type { CacheEvent } from '../types/main.js'

export class CacheHit implements CacheEvent {
  name = 'cache:hit' as const

  constructor(
    readonly key: string,
    readonly value: any,
    readonly store: string
  ) {}

  toJSON() {
    return {
      key: this.key,
      value: this.value,
      store: this.store,
    }
  }
}
