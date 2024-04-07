import type { CacheBusMessage, CacheEvent } from '../../types/main.js'

/**
 * Event when the bus publishes a message
 */
export class BusMessagePublished implements CacheEvent {
  name = 'bus:message:published' as const

  constructor(readonly message: CacheBusMessage) {}

  toJSON() {
    return {
      keys: this.message.keys,
      type: this.message.type,
    }
  }
}
