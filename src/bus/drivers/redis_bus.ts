import { Redis as IoRedis, type RedisOptions as IoRedisOptions } from 'ioredis'

import type { BusEncoder } from '../../types/bus.js'
import { BinaryEncoder } from '../encoders/binary_encoder.js'
import { type BusDriver, type CacheBusMessage } from '../../types/bus.js'

/**
 * A Redis Bus driver
 *
 * Leverage Redis Pub/Sub to publish and subscribe to messages
 */
export class RedisBus implements BusDriver {
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

  /**
   * The encoder used to encode and decode messages
   *
   * By default, we use the BinaryEncoder. See the benchmarks
   * file for more information
   */
  #encoder: BusEncoder
  #id!: string

  constructor(connection: IoRedisOptions, encoder?: BusEncoder) {
    this.#subscriber = new IoRedis(connection)
    this.#publisher = new IoRedis(connection)
    this.#encoder = encoder ?? new BinaryEncoder()
  }

  setId(id: string) {
    this.#id = id
    return this
  }

  /**
   * When the Redis client reconnects
   * Can happen when the connection is lost
   */
  onReconnect(callback: () => void): void {
    this.#subscriber.on('reconnecting', callback)
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

      const data = this.#encoder.decode(message)

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
    const encoded = this.#encoder.encode({ busId: this.#id, ...message })

    await this.#publisher.publish(channelName, encoded)
  }

  /**
   * Disconnects the Redis clients
   */
  async disconnect(): Promise<void> {
    this.#publisher.disconnect()
    this.#subscriber.disconnect()
  }
}
