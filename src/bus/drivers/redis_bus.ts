import type { CacheBusMessage, CacheBusPublisher, CacheBusSubscriber } from '../../types/bus.js'
import { Redis as IoRedis } from 'ioredis'
import type { RedisOptions as IoRedisOptions } from 'ioredis'

export class RedisBus implements CacheBusPublisher, CacheBusSubscriber {
  #redis: IoRedis

  constructor(connection: IoRedis | IoRedisOptions) {
    this.#redis = connection instanceof IoRedis ? connection : new IoRedis(connection)
  }
  async disconnect(): Promise<void> {
    this.#redis.disconnect()
  }

  async unsubscribe(channel: string): Promise<void> {
    await this.#redis.unsubscribe(channel)
  }

  async subscribe(channel: string, handler: (message: CacheBusMessage) => void): Promise<void> {
    await this.#redis.subscribe(channel, (err, count) => {
      if (err) {
        throw err
      }

      console.log(
        `Subscribed to ${count} channel. Listening for updates on the ${channel} channel.`
      )
    })

    this.#redis.on('message', (receivedChannel, message) => {
      if (channel !== receivedChannel) {
        return
      }

      handler(JSON.parse(message))
    })
  }

  async publish(channel: string, message: CacheBusMessage): Promise<void> {
    await this.#redis.publish(channel, JSON.stringify(message))
  }
}
