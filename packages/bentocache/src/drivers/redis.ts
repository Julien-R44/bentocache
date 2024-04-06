import { Redis as IoRedis } from 'ioredis'
import { RedisTransport } from '@rlanz/bus/drivers/redis'
import type { RedisOptions as IoRedisOptions } from 'ioredis'

import { BaseDriver } from './base_driver.js'
import type {
  BusOptions,
  CreateBusDriverResult,
  CreateDriverResult,
  L2CacheDriver,
  RedisConfig,
} from '../types/main.js'

/**
 * Create a new cache redis driver
 */
export function redisDriver(options: RedisConfig): CreateDriverResult<RedisDriver> {
  return { options, factory: (config: RedisConfig) => new RedisDriver(config) }
}

/**
 * Create a new bus redis driver. It leverages the Pub/sub capabilities of Redis
 * to sending messages between your different processes.
 */
export function redisBusDriver(
  options: { connection: IoRedisOptions } & BusOptions,
): CreateBusDriverResult {
  return { options, factory: (config: IoRedisOptions) => new RedisTransport(config) }
}

/**
 * Caching driver for Redis
 */
export class RedisDriver extends BaseDriver implements L2CacheDriver {
  type = 'l2' as const
  #connection: IoRedis
  declare config: RedisConfig

  constructor(config: RedisConfig) {
    super(config)

    if (config.connection instanceof IoRedis) {
      this.#connection = config.connection
      return
    }

    this.#connection = new IoRedis(config.connection)
  }

  getConnection() {
    return this.#connection
  }

  /**
   * Returns a new instance of the driver namespaced
   */
  namespace(namespace: string) {
    return new RedisDriver({
      ...this.config,
      connection: this.#connection,
      prefix: this.createNamespacePrefix(namespace),
    })
  }

  /**
   * Get a value from the cache
   */
  async get(key: string) {
    const result = await this.#connection.get(this.getItemKey(key))
    return result ?? undefined
  }

  /**
   * Get the value of a key and delete it
   *
   * Returns the value if the key exists, undefined otherwise
   */
  async pull(key: string) {
    const value = await this.#connection.getdel(this.getItemKey(key))

    return value ?? undefined
  }

  /**
   * Put a value in the cache
   * Returns true if the value was set, false otherwise
   */
  async set(key: string, value: string, ttl?: number) {
    key = this.getItemKey(key)

    if (!ttl) {
      const result = await this.#connection.set(key, value)
      return result === 'OK'
    }

    const result = await this.#connection.set(key, value, 'PX', ttl)
    return result === 'OK'
  }

  /**
   * Check if a key exists in the cache
   */
  async has(key: string) {
    const exists = await this.#connection.exists(this.getItemKey(key))
    return exists > 0
  }

  /**
   * Remove all items from the cache
   */
  async clear() {
    const keys = await this.#connection.keys(`${this.prefix}*`)

    if (keys.length) {
      await this.#connection.del(keys)
    }
  }

  /**
   * Delete a key from the cache
   * Returns true if the key was deleted, false otherwise
   */
  async delete(key: string) {
    const deletedKeys = await this.#connection.del(this.getItemKey(key))
    return deletedKeys > 0
  }

  /**
   * Delete multiple keys from the cache
   */
  async deleteMany(keys: string[]) {
    await this.#connection.del(keys.map((key) => this.getItemKey(key)))
    return true
  }

  /**
   * Closes the connection to the cache
   */
  async disconnect() {
    await this.#connection.quit()
  }
}
