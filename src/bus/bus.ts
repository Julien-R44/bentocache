import type { LocalCache } from '../local_cache.js'
import { CacheBusMessageType } from '../types/bus.js'
import type { BusDriver, CacheBusMessage, Logger } from '../types/main.js'

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
   * The local cache that will be updated when a message is received
   */
  #cache?: LocalCache

  /**
   * The logger to use
   */
  #logger: Logger

  /**
   * The channel name to use
   */
  #channelName = 'bentocache.notifications'

  constructor(driver: BusDriver, cache: LocalCache, logger: Logger) {
    this.#driver = driver
    this.#cache = cache
    this.#logger = logger.child({ context: 'bentocache.bus' })
  }

  /**
   * When a message is received through the bus.
   * This is where we update the local cache.
   */
  #onMessage(message: CacheBusMessage) {
    this.#logger.trace({ keys: message.keys, type: message.type }, 'received message from bus')

    if (message.type === CacheBusMessageType.Set || message.type === CacheBusMessageType.Delete) {
      for (const key of message.keys) {
        this.#cache?.delete(key) // todo should allow graceful retain
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
    this.#logger.trace({ keys: message.keys, type: message.type }, 'publishing message to bus')

    await this.#driver.publish(this.#channelName, { ...message })
  }

  /**
   * Disconnect the bus
   */
  async disconnect(): Promise<void> {
    this.#driver.disconnect()
  }
}
