import { RedisClient } from 'bun'

import { BaseDriver } from './base_driver.js'
import type { BunRedisConfig, CreateDriverResult, L2CacheDriver } from '../types/main.js'

export function bunRedisDriver(options: BunRedisConfig): CreateDriverResult<BunRedisDriver> {
  return { options, factory: (config: BunRedisConfig) => new BunRedisDriver(config) }
}

export class BunRedisDriver extends BaseDriver implements L2CacheDriver {
  type = 'l2' as const
  #connection: RedisClient
  declare config: BunRedisConfig

  constructor(config: BunRedisConfig) {
    super(config)

    if (config.connection instanceof RedisClient) {
      this.#connection = config.connection
      return
    }

    if (typeof config.connection === 'string') {
      this.#connection = new RedisClient(config.connection, config.options)
      return
    }

    const { url, ...rest } = config.connection
    this.#connection = new RedisClient(url, { ...rest, ...config.options })
  }

  getConnection() {
    return this.#connection
  }

  namespace(namespace: string) {
    return new BunRedisDriver({
      ...this.config,
      connection: this.#connection,
      prefix: this.createNamespacePrefix(namespace),
    })
  }

  async get(key: string) {
    const result = await this.#connection.get(this.getItemKey(key))
    return result ?? undefined
  }

  async pull(key: string) {
    const result = (await this.#connection.send('GETDEL', [this.getItemKey(key)])) as string | null
    return result ?? undefined
  }

  async set(key: string, value: string, ttl?: number) {
    const itemKey = this.getItemKey(key)

    if (!ttl) {
      const result = (await this.#connection.send('SET', [itemKey, value])) as string | null
      return result === 'OK'
    }

    const result = (await this.#connection.send('SET', [itemKey, value, 'PX', String(ttl)])) as
      | string
      | null
    return result === 'OK'
  }

  async clear() {
    let cursor = '0'
    const pattern = this.prefix ? `${this.prefix}:*` : '*'

    do {
      const [nextCursor, keys] = (await this.#connection.send('SCAN', [
        cursor,
        'MATCH',
        pattern,
        'COUNT',
        '1000',
      ])) as [string, string[]]

      if (keys.length) await this.#connection.send('UNLINK', keys)
      cursor = nextCursor
    } while (cursor !== '0')
  }

  async delete(key: string) {
    const deleted = (await this.#connection.send('UNLINK', [this.getItemKey(key)])) as number
    return deleted > 0
  }

  async deleteMany(keys: string[]) {
    if (keys.length === 0) return true
    await this.#connection.send(
      'UNLINK',
      keys.map((key) => this.getItemKey(key)),
    )
    return true
  }

  async disconnect() {
    this.#connection.close()
  }
}
