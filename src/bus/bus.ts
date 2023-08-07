import { Redis as IoRedis } from 'ioredis'
import type { RedisOptions as IoRedisOptions } from 'ioredis'

import { randomUUID } from 'node:crypto'
import { CacheBusMessageType } from '../types/bus.js'
import type { BusDriver, CacheBusMessage, CacheDriver } from '../types/main.js'

export class Bus {
  id = randomUUID()
  #driver: BusDriver
  #cache?: CacheDriver

  channelName = 'bentocache.notifications'

  constructor(driver: BusDriver, cache: CacheDriver) {
    this.#driver = driver
    this.#cache = cache
  }

  async disconnect(): Promise<void> {
    this.#driver.disconnect()
  }

  async subscribe() {
    this.#driver.subscribe(this.channelName, this.onMessage.bind(this))
  }

  onMessage(message: CacheBusMessage) {
    /**
     * Ignore messages coming from this bus
     */
    if (message.busId === this.id) {
      return
    }

    if (message.type === CacheBusMessageType.Set || message.type === CacheBusMessageType.Delete) {
      for (const key of message.keys) {
        this.#cache?.delete(key) // should allow graceful retain
      }
    }
  }

  async publish(message: Omit<CacheBusMessage, 'busId'>): Promise<void> {
    await this.#driver.publish(this.channelName, { ...message })
  }
}
