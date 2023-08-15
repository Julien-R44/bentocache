/*
 * @blizzle/bentocache
 *
 * (c) Blizzle
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import type { Logger, BusDriver, CacheBusMessage } from '../../types/main.js'

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

  /**
   * List of messages received by this bus
   */
  receivedMessages: CacheBusMessage[] = []

  #id!: string
  _logger?: Logger

  setId(id: string) {
    this.#id = id
    return this
  }

  setLogger(logger: Logger) {
    this._logger = logger
    return this
  }

  /**
   * Subscribes to the given channel
   */
  async subscribe(channelName: string, handler: (message: CacheBusMessage) => void) {
    const handlers = MemoryBus.#subscriptions.get(channelName) || []

    handlers.push({
      handler: (message) => {
        this.receivedMessages.push(message)
        handler(message)
      },
      busId: this.#id,
    })
    MemoryBus.#subscriptions.set(channelName, handlers)
  }

  /**
   * Unsubscribes from the given channel
   */
  async unsubscribe(channelName: string) {
    const handlers = MemoryBus.#subscriptions.get(channelName) || []

    MemoryBus.#subscriptions.set(
      channelName,
      handlers.filter((handlerInfo) => handlerInfo.busId !== this.#id)
    )
  }

  /**
   * Publishes a message to the given channel
   */
  async publish(channelName: string, message: Omit<CacheBusMessage, 'busId'>): Promise<void> {
    const handlers = MemoryBus.#subscriptions.get(channelName)
    if (!handlers) return

    const fullMessage: CacheBusMessage = { ...message, busId: this.#id }

    for (const { handler, busId } of handlers) {
      if (busId === this.#id) continue

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
