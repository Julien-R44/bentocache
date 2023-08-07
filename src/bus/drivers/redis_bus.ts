import { randomUUID } from 'node:crypto'
import { Redis as IoRedis } from 'ioredis'
import type { RedisOptions as IoRedisOptions } from 'ioredis'
import type { BusDriver, CacheBusMessage } from '../../types/bus.js'

export class RedisBus implements BusDriver {
  id = randomUUID()
  #publisher: IoRedis
  #subscriber: IoRedis

  constructor(connection: IoRedisOptions) {
    this.#subscriber = new IoRedis(connection)
    this.#publisher = new IoRedis(connection)
  }

  async disconnect(): Promise<void> {
    this.#publisher.disconnect()
    this.#subscriber.disconnect()
  }

  async unsubscribe(channel: string): Promise<void> {
    await this.#subscriber.unsubscribe(channel)
  }

  async subscribe(channelName: string, handler: (message: CacheBusMessage) => void): Promise<void> {
    this.#subscriber.subscribe(channelName, (err) => {
      if (err) {
        throw err
      }
    })

    this.#subscriber.on('message', (receivedChannel, message) => {
      if (channelName !== receivedChannel) {
        return
      }

      handler(JSON.parse(message))
    })
  }

  async publish(channelName: string, message: Omit<CacheBusMessage, 'busId'>): Promise<void> {
    await this.#publisher.publish(channelName, JSON.stringify({ busId: this.id, ...message }))
  }
}
