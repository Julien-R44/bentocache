import { randomUUID } from 'node:crypto'
import { Redis as IoRedis, type RedisOptions as IoRedisOptions } from 'ioredis'

import type { BusDriver, CacheBusMessage } from '../../types/bus.js'

/**
 * A Redis Bus driver
 *
 * Leverage Redis Pub/Sub to publish and subscribe to messages
 */
export class RedisBus implements BusDriver {
  /**
   * A unique identifier for this bus instance
   * that is used to prevent the bus from
   * emitting events to itself
   */
  #id = randomUUID()

  /**
   * The Redis client used to publish messages
   *
   * We need a separate client for publishing because the
   * subscriber client is blocked while subscribed to a
   * channel and cannot be used to publish messages
   */
  #publisher: IoRedis

  /**
   * The Redis client used to subscribe to messages
   */
  #subscriber: IoRedis

  constructor(connection: IoRedisOptions) {
    this.#subscriber = new IoRedis(connection)
    this.#publisher = new IoRedis(connection)
  }

  /**
   * Subscribes to the given channel with the given handler
   */
  async subscribe(channelName: string, handler: (message: CacheBusMessage) => void): Promise<void> {
    this.#subscriber.subscribe(channelName, (err) => {
      if (err) {
        throw err
      }
    })

    this.#subscriber.on('message', (receivedChannel, message) => {
      if (channelName !== receivedChannel) return

      const data = JSON.parse(message)

      /**
       * Ignore messages published by this bus instance
       */
      if (data.busId === this.#id) return

      handler(data)
    })
  }

  /**
   * Unsubscribes from the given channel
   */
  async unsubscribe(channel: string): Promise<void> {
    await this.#subscriber.unsubscribe(channel)
  }

  /**
   * Publishes a message to the given channel
   */
  async publish(channelName: string, message: Omit<CacheBusMessage, 'busId'>): Promise<void> {
    await this.#publisher.publish(channelName, JSON.stringify({ busId: this.#id, ...message }))
  }

  /**
   * Disconnects the Redis clients
   */
  async disconnect(): Promise<void> {
    this.#publisher.disconnect()
    this.#subscriber.disconnect()
  }
}
