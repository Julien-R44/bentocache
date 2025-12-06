import type { RedisOptions as IoRedisOptions } from 'ioredis'
import { RedisTransport } from '@boringnode/bus/transports/redis'
import { Redis as IoRedis, Cluster as IoRedisCluster } from 'ioredis'
import type { RedisTransportConfig } from '@boringnode/bus/types/main'

import { BaseDriver } from './base_driver.js'
import { BinaryEncoder } from '../bus/encoders/binary_encoder.js'
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
 *
 * You can pass either connection options or an existing Redis/Cluster instance.
 */
export function redisBusDriver(
  options: { connection: IoRedisOptions | IoRedis | IoRedisCluster } & BusOptions,
): CreateBusDriverResult {
  return {
    options,
    factory: () => {
      /**
       * If an existing Redis or Cluster instance is passed, use it directly
       */
      if (options.connection instanceof IoRedis || options.connection instanceof IoRedisCluster) {
        return new RedisTransport(options.connection, new BinaryEncoder(), {
          useMessageBuffer: true,
        })
      }

      return new RedisTransport(
        { ...options.connection, useMessageBuffer: true } as RedisTransportConfig,
        new BinaryEncoder(),
      )
    },
  }
}

/**
 * Caching driver for Redis
 */
export class RedisDriver extends BaseDriver implements L2CacheDriver {
  type = 'l2' as const
  #connection: IoRedis | IoRedisCluster
  declare config: RedisConfig

  constructor(config: RedisConfig) {
    super(config)

    if (config.connection instanceof IoRedis || config.connection instanceof IoRedisCluster) {
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
   * Remove all items from the cache
   */
  async clear() {
    let cursor = '0'
    const COUNT = 1000
    const prefix = this.prefix && `${this.prefix}:`
    const connectionKeyPrefix = this.#connection.options.keyPrefix

    do {
      const [newCursor, keys] = await this.#connection.scan(
        cursor,
        'MATCH',
        `${connectionKeyPrefix}${prefix}*`,
        'COUNT',
        COUNT,
      )

      if (keys.length) {
        const pipeline = this.#connection.pipeline()
        for (const key of keys) pipeline.unlink(key.slice(connectionKeyPrefix?.length))
        await pipeline.exec()
      }

      cursor = newCursor
    } while (cursor !== '0')
  }

  /**
   * Delete a key from the cache
   * Returns true if the key was deleted, false otherwise
   */
  async delete(key: string) {
    const deletedKeys = await this.#connection.unlink(this.getItemKey(key))
    return deletedKeys > 0
  }

  /**
   * Delete multiple keys from the cache
   */
  async deleteMany(keys: string[]) {
    if (keys.length === 0) return true

    const pipeline = this.#connection.pipeline()
    for (const key of keys) pipeline.unlink(this.getItemKey(key))
    await pipeline.exec()

    return true
  }

  /**
   * Closes the connection to the cache
   */
  async disconnect() {
    this.#connection.disconnect()
  }
}
