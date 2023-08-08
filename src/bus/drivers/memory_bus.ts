import { createId } from '@paralleldrive/cuid2'
import type { BusDriver, CacheBusMessage } from '../../types/bus.js'

/**
 * A simple in-memory bus driver for easy
 * testing
 */
export class MemoryBus implements BusDriver {
  /**
   * A Map that stores the subscriptions for each channel.
   *
   * key is the channel name and the value is an array of objects
   * containing the handler function and the busId of the subscriber
   */
  static #subscriptions: Map<
    string,
    Array<{
      handler: (message: CacheBusMessage) => void
      busId: string
    }>
  > = new Map()

  constructor(protected id = createId()) {}

  /**
   * Subscribes to the given channel
   */
  async subscribe(channelName: string, handler: (message: CacheBusMessage) => void) {
    const handlers = MemoryBus.#subscriptions.get(channelName) || []

    handlers.push({ handler, busId: this.id })
    MemoryBus.#subscriptions.set(channelName, handlers)
  }

  /**
   * Unsubscribes from the given channel
   */
  async unsubscribe(channelName: string) {
    const handlers = MemoryBus.#subscriptions.get(channelName) || []

    MemoryBus.#subscriptions.set(
      channelName,
      handlers.filter((handlerInfo) => handlerInfo.busId !== this.id)
    )
  }

  /**
   * Publishes a message to the given channel
   */
  async publish(channelName: string, message: Omit<CacheBusMessage, 'busId'>): Promise<void> {
    const handlers = MemoryBus.#subscriptions.get(channelName)
    if (!handlers) return

    const fullMessage: CacheBusMessage = { ...message, busId: this.id }

    for (const { handler, busId } of handlers) {
      if (busId === this.id) continue

      handler(fullMessage)
    }
  }

  /**
   * Disconnects the bus and clears all subscriptions
   */
  async disconnect() {
    MemoryBus.#subscriptions.clear()
  }

  async onReconnect(_callback: () => void) {}
}
