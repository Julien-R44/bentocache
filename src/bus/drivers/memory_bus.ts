import { randomUUID } from 'node:crypto'
import type { BusDriver, CacheBusMessage } from '../../types/bus.js'

export class MemoryBus implements BusDriver {
  static subscriptions: Map<
    string,
    Array<{ handler: (message: CacheBusMessage) => void; busId: string }>
  > = new Map()

  id = randomUUID()

  constructor() {}

  async disconnect() {
    MemoryBus.subscriptions.clear()
  }

  async unsubscribe(channelName: string) {
    const handlers = MemoryBus.subscriptions.get(channelName) || []

    MemoryBus.subscriptions.set(
      channelName,
      handlers.filter((handlerInfo) => handlerInfo.busId !== this.id)
    )
  }

  async subscribe(channelName: string, handler: (message: CacheBusMessage) => void) {
    const handlers = MemoryBus.subscriptions.get(channelName) || []

    handlers.push({ handler, busId: this.id })
    MemoryBus.subscriptions.set(channelName, handlers)
  }

  async publish(channelName: string, message: Omit<CacheBusMessage, 'busId'>): Promise<void> {
    const handlers = MemoryBus.subscriptions.get(channelName)
    if (!handlers) {
      return
    }

    const fullMessage: CacheBusMessage = { ...message, busId: this.id }

    for (const { handler, busId } of handlers) {
      if (busId !== this.id) {
        handler(fullMessage)
      }
    }
  }
}
