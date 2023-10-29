import { createId } from '@paralleldrive/cuid2'

import { RetryQueue } from './retry_queue.js'
import type { LocalCache } from '../cache/facades/local_cache.js'
import { CacheBusMessageType } from '../types/bus.js'
import { BusMessageReceived } from '../events/bus/bus_message_received.js'
import { BusMessagePublished } from '../events/bus/bus_message_published.js'
import type { BusDriver, BusOptions, CacheBusMessage, Emitter, Logger } from '../types/main.js'

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

  /**
   * The error retry queue holds messages that failed to be sent
   */
  #errorRetryQueue = new RetryQueue()

  constructor(
    driver: BusDriver,
    cache: LocalCache,
    logger: Logger,
    emitter: Emitter,
    options: BusOptions = {}
  ) {
    this.#driver = driver
    this.#cache = cache
    this.#emitter = emitter
    this.#logger = logger.child({ context: 'bentocache.bus' })
    this.#errorRetryQueue = new RetryQueue(options.retryQueue?.enabled, options.retryQueue?.maxSize)

    driver
      .setId(this.#busId)
      .setLogger(this.#logger)
      .onReconnect(() => this.#onReconnect())
  }

  /**
   * Process the error retry queue
   */
  async #processErrorRetryQueue() {
    this.#logger.debug(
      `starting error retry queue processing with ${this.#errorRetryQueue.size()} messages`
    )

    await this.#errorRetryQueue.process(async (message) => {
      await this.publish(message)
      return true
    })
  }

  /**
   * When a message is received through the bus.
   * This is where we update the local cache.
   */
  async #onMessage(message: CacheBusMessage) {
    /**
     * Since we received a message from the bus, we assume that
     * the Bus is working. So we can try process the error retry queue if
     * there are any messages in it.
     */
    await this.#processErrorRetryQueue()

    this.#logger.trace({ keys: message.keys, type: message.type }, 'received message from bus')
    this.#emitter.emit('bus:message:received', new BusMessageReceived(message))

    /**
     * Process the message
     */
    if (message.type === CacheBusMessageType.Delete) {
      for (const key of message.keys) this.#cache?.delete(key)
    }

    if (message.type === CacheBusMessageType.Set) {
      for (const key of message.keys) this.#cache?.logicallyExpire(key)
    }
  }

  /**
   * When the bus driver reconnects after a disconnection
   */
  async #onReconnect() {
    this.#logger.debug('bus driver reconnected')
    await this.#processErrorRetryQueue()
  }

  /**
   * Subscribe to the bus channel
   */
  async subscribe() {
    this.#driver.subscribe(this.#channelName, this.#onMessage.bind(this))
  }

  /**
   * Publish a message to the bus channel
   *
   * @returns true if the message was published, false if not
   */
  async publish(message: Omit<CacheBusMessage, 'busId'>): Promise<boolean> {
    const fullMessage = { ...message, busId: this.#busId }

    try {
      this.#logger.trace({ keys: message.keys, type: message.type }, 'publishing message to bus')

      /**
       * Publish the message to the bus using the underlying driver
       */
      await this.#driver.publish(this.#channelName, fullMessage)

      /**
       * Emit the bus:message:published event
       */
      this.#emitter.emit('bus:message:published', new BusMessagePublished(fullMessage))
      return true
    } catch (error) {
      this.#logger.error(error, 'failed to publish message to bus')

      /**
       * Add to the error retry queue
       */
      const wasAdded = this.#errorRetryQueue.enqueue(fullMessage)
      if (!wasAdded) return false

      this.#logger.debug(message, 'added message to error retry queue')
      return false
    }
  }

  /**
   * Disconnect the bus
   */
  async disconnect(): Promise<void> {
    this.#driver.disconnect()
  }
}
