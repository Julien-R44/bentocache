/*
 * @adonisjs/cache
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { Redis as IoRedis } from 'ioredis'

import { BaseDriver } from './base_driver.js'
import type { CacheDriver, CachedValue, RedisConfig } from '../types/main.js'

export class Redis extends BaseDriver implements CacheDriver {
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
    return new Redis({
      ...this.config,
      connection: this.#connection,
      prefix: this.joinPrefixes(this.getPrefix(), namespace),
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
   * Get many values from the cache
   * Will return an array of objects with `key` and `value` properties
   * If a value is not found, `value` will be undefined
   */
  async getMany(keys: string[]) {
    const prefixedKeys = keys.map((key) => this.getItemKey(key))
    const result = await this.#connection.mget(prefixedKeys)

    return keys.map((key, index) => ({
      key: key,
      value: result[index] ?? undefined,
    }))
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
  async set(key: string, value: CachedValue, ttl?: number) {
    key = this.getItemKey(key)

    if (!ttl) {
      const result = await this.#connection.set(key, value)
      return result === 'OK'
    }

    const result = await this.#connection.set(key, value, 'PX', ttl)
    return result === 'OK'
  }

  /**
   * Set many values in the cache
   */
  async setMany(values: { key: string; value: CachedValue }[], ttl?: number) {
    const prefixedValues = values.map((value) => ({
      key: this.getItemKey(value.key),
      value: value.value,
    }))

    const commands = prefixedValues.map((value) =>
      ['set', value.key, value.value].concat(ttl ? ['PX', ttl] : [])
    )

    await this.#connection.multi(commands).exec()

    return true
  }

  /**
   * Add the given amount to the value of a key.
   * Creates the key if it doesn't exist
   */
  async add(key: string, amount: number) {
    key = this.getItemKey(key)
    return this.#connection.incrby(key, amount)
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
    const keys = await this.#connection.keys(`${this.getPrefix()}*`)

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
