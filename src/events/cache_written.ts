import type { CacheEvent } from '../types/main.js'

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
