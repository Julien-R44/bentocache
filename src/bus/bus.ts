import { createId } from '@paralleldrive/cuid2'
import { BusMessagePublished } from '../events/bus_message_published.js'
import type { LocalCache } from '../local_cache.js'
import { CacheBusMessageType } from '../types/bus.js'
import type { BusDriver, CacheBusMessage, Emitter, Logger } from '../types/main.js'
import { BusMessageReceived } from '../events/bus_message_received.js'

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
   * Emitter
   */
  #emitter: Emitter

  /**
   * A unique identifier for this bus instance
   * that is used to prevent the bus from
   * emitting events to itself
   */
  #busId = createId()

  /**
   * The channel name to use
   */
  #channelName = 'bentocache.notifications'

  constructor(driver: BusDriver, cache: LocalCache, logger: Logger, emitter: Emitter) {
    this.#driver = driver
    this.#cache = cache
    this.#emitter = emitter
    this.#logger = logger.child({ context: 'bentocache.bus' })
  }

  /**
   * When a message is received through the bus.
   * This is where we update the local cache.
   */
  #onMessage(message: CacheBusMessage) {
    this.#logger.trace({ keys: message.keys, type: message.type }, 'received message from bus')
    this.#emitter.emit('bus:message:received', new BusMessageReceived(message))

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

    /**
     * Publish the message to the bus using the underlying driver
     */
    const fullMessage = { ...message, busId: this.#busId }
    await this.#driver.publish(this.#channelName, fullMessage)

    /**
     * Emit the bus:message:published event
     */
    this.#emitter.emit('bus:message:published', new BusMessagePublished(fullMessage))
  }

  /**
   * Disconnect the bus
   */
  async disconnect(): Promise<void> {
    this.#driver.disconnect()
  }
}
