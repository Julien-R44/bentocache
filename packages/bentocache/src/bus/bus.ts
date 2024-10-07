import { Bus as RlanzBus } from '@boringnode/bus'
import type { Transport } from '@boringnode/bus/types/main'

import { CacheBusMessageType } from '../types/bus.js'
import { BaseDriver } from '../drivers/base_driver.js'
import type { LocalCache } from '../cache/facades/local_cache.js'
import { BusMessageReceived } from '../events/bus/bus_message_received.js'
import { BusMessagePublished } from '../events/bus/bus_message_published.js'
import type { BusOptions, CacheBusMessage, Emitter, Logger } from '../types/main.js'

/**
 * The bus is used to notify other processes about cache changes.
 * We use an underlying bus driver to send and receive messages.
 *
 * So basically, when a cache entry is set or deleted, we publish
 * a message to the bus channel. Other processes are subscribed to
 * the same channel and will receive the message and update their
 * local cache accordingly.
 */
export class Bus extends BaseDriver {
  #bus: RlanzBus
  #logger: Logger
  #emitter: Emitter
  #cache?: LocalCache
  #channelName = 'bentocache.notifications'

  constructor(
    driver: Transport,
    cache: LocalCache,
    logger: Logger,
    emitter: Emitter,
    options: BusOptions = {},
  ) {
    super(options)
    this.#cache = cache
    this.#emitter = emitter
    this.#logger = logger.child({ context: 'bentocache.bus' })

    this.#bus = new RlanzBus(driver, {
      retryQueue: {
        ...options.retryQueue,
        removeDuplicates: true,
        retryInterval: options.retryQueue?.retryInterval || false,
      },
    })

    if (this.prefix) this.#channelName += `:${this.prefix}`

    this.#bus.subscribe<CacheBusMessage>(this.#channelName, this.#onMessage.bind(this))
    this.#logger.trace({ channel: this.#channelName }, 'bus subscribed to channel')
  }

  namespace(namespace: string): string {
    return this.createNamespacePrefix(namespace)
  }

  /**
   * When a message is received through the bus.
   * This is where we update the local cache.
   */
  async #onMessage(message: CacheBusMessage) {
    this.#logger.trace(
      { keys: message.keys, type: message.type, channel: this.#channelName },
      'received message from bus',
    )
    this.#emitter.emit('bus:message:received', new BusMessageReceived(message))

    if (message.type === CacheBusMessageType.Delete) {
      for (const key of message.keys) this.#cache?.delete(key)
    }

    if (message.type === CacheBusMessageType.Set) {
      for (const key of message.keys) this.#cache?.logicallyExpire(key)
    }

    if (message.type === CacheBusMessageType.Clear) {
      this.#cache?.clear()
    }
  }

  /**
   * Publish a message to the bus channel
   *
   * @returns true if the message was published, false if not
   */
  async publish(message: CacheBusMessage): Promise<boolean> {
    const wasPublished = await this.#bus.publish(this.#channelName, message)
    if (wasPublished) {
      this.#emitter.emit('bus:message:published', new BusMessagePublished(message))
      return true
    }

    this.#logger.error('failed to publish message to bus')
    return false
  }

  /**
   * Disconnect the bus
   */
  async disconnect(): Promise<void> {
    await this.#bus.disconnect()
  }
}
