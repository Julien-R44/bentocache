import { CacheBusMessageType } from '../types/bus.js'
import type { BusDriver, CacheBusMessage, CacheDriver } from '../types/main.js'

/**
 * The bus is used to notify other processes about cache changes.
 * We use an underlying bus driver to send and receive messages.
 *
 * So basically, when a cache entry is set or deleted, we publish
 * a message to the bus channel. Other processes are subscribed to
 * the same channel and will receive the message and update their
 * local cache accordingly.
 */
export class Bus {
  /**
   * The underlying bus driver
   */
  #driver: BusDriver

  /**
   * The cache driver to be notified
   */
  #cache?: CacheDriver

  /**
   * The channel name to use
   */
  #channelName = 'bentocache.notifications'

  constructor(driver: BusDriver, cache: CacheDriver) {
    this.#driver = driver
    this.#cache = cache
  }

  /**
   * When a message is received through the bus.
   * This is where we update the local cache.
   */
  #onMessage(message: CacheBusMessage) {
    if (message.type === CacheBusMessageType.Set || message.type === CacheBusMessageType.Delete) {
      for (const key of message.keys) {
        this.#cache?.delete(key) // should allow graceful retain
      }
    }
  }

  /**
   * Subscribe to the bus channel
   */
  async subscribe() {
    this.#driver.subscribe(this.#channelName, this.#onMessage.bind(this))
  }

  /**
   * Publish a message to the bus channel
   */
  async publish(message: Omit<CacheBusMessage, 'busId'>): Promise<void> {
    await this.#driver.publish(this.#channelName, { ...message })
  }

  /**
   * Disconnect the bus
   */
  async disconnect(): Promise<void> {
    this.#driver.disconnect()
  }
}
