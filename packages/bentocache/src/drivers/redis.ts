import { Redis as IoRedis } from 'ioredis'
import { InvalidArgumentsException } from '@poppinss/exception'
import { RedisTransport } from '@boringnode/bus/transports/redis'
import type { RedisTransportConfig } from '@boringnode/bus/types/main'
import type { Cluster as IoRedisCluster, RedisOptions as IoRedisOptions } from 'ioredis'

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
 * Detect an already-instantiated ioredis client ( `Redis` or `Cluster` ) as
 * opposed to a plain connection options object.
 *
 * We deliberately do *not* use `instanceof` here. `instanceof` is evaluated
 * against the `ioredis` copy that *bentocache* resolved, so it returns `false`
 * for a perfectly valid client whenever the host application resolved a
 * different `ioredis` major (two copies in the tree). The old code then fell
 * through to `new IoRedis(<a live client>)`; ioredis ignores the unrecognised
 * properties and silently connects to `127.0.0.1:6379`.
 *
 * `duplicate` and `sendCommand` are defined on the prototype of both `Redis`
 * and `Cluster` in every ioredis major, and neither name exists in
 * `RedisOptions` / `ClusterOptions`, so an options object can never be
 * misclassified as a client.
 *
 * Note that `constructor.name` is not usable as a discriminator either: ioredis
 * builds its clients through a mixin, so it reports `EventEmitter` for both
 * `Redis` and `Cluster`.
 */
function isIoRedisClient(connection: unknown): connection is IoRedis | IoRedisCluster {
  if (typeof connection !== 'object' || connection === null) return false

  const candidate = connection as Partial<IoRedis>
  return typeof candidate.duplicate === 'function' && typeof candidate.sendCommand === 'function'
}

/**
 * Guard against the failure mode that made the `instanceof` bug so expensive:
 * silently building a connection to `127.0.0.1:6379` out of something that was
 * never an options object.
 *
 * If the value was not recognised as a client but still carries the markers of
 * an event-emitting, stateful client ( a `status` string, an `options` bag and
 * `emit` ), we refuse loudly instead of dialing localhost. None of these three
 * names exist in `RedisOptions` / `ClusterOptions`, so a legitimate options
 * object never trips this.
 */
function assertIsConnectionOptions(connection: unknown): void {
  if (typeof connection !== 'object' || connection === null) return

  const candidate = connection as Record<string, unknown>
  const looksLikeAClient =
    typeof candidate.status === 'string' &&
    typeof candidate.options === 'object' &&
    candidate.options !== null &&
    typeof candidate.emit === 'function'

  if (!looksLikeAClient) return

  throw new InvalidArgumentsException(
    'The `connection` given to the Redis driver looks like a Redis client, but is not a ' +
      'recognizable ioredis client. This usually means an incompatible or unsupported ' +
      '`ioredis` build was used. Refusing to fall back to a new connection on ' +
      '127.0.0.1:6379 - pass either an ioredis `Redis`/`Cluster` instance or a plain ' +
      'connection options object.',
  )
}

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
      if (isIoRedisClient(options.connection)) {
        return new RedisTransport(options.connection, new BinaryEncoder(), {
          useMessageBuffer: true,
        })
      }

      assertIsConnectionOptions(options.connection)

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

    if (isIoRedisClient(config.connection)) {
      this.#connection = config.connection
      return
    }

    assertIsConnectionOptions(config.connection)

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
