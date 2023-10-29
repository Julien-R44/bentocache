import type { CacheBusMessage, CacheEvent } from '../../types/main.js'

/**
 * Event when the bus receives a message
 */
export class BusMessageReceived implements CacheEvent {
  name = 'bus:message:received' as const

  constructor(readonly message: CacheBusMessage) {}

  toJSON() {
    return {
      busId: this.message.busId,
      keys: this.message.keys,
      type: this.message.type,
    }
  }
}
