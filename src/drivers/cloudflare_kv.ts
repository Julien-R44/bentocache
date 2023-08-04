/*
 * @adonisjs/cache
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import got, { type Got } from 'got'
import chunkify from '@sindresorhus/chunkify'

import { BaseDriver } from './base_driver.js'
import type { CacheDriver, CloudflareKvConfig, KeyValueObject } from '../types/main.js'

export class CloudflareKv extends BaseDriver implements CacheDriver {
  #got: Got
  declare config: CloudflareKvConfig

  constructor(config: CloudflareKvConfig) {
    super(config)

    this.#got = got.extend({
      prefixUrl: `https://api.cloudflare.com/client/v4/accounts/${config.accountId}/storage/kv/namespaces/${config.namespaceId}`,
      headers: { Authorization: `Bearer ${config.apiToken}` },
    })
  }

  /**
   * Cloudflare only supports ttl superior to 60 seconds.
   * Also accepts TTLs in seconds.
   */
  #getTtl(ttlInMs: number | undefined) {
    if (!ttlInMs) {
      return undefined
    }

    const minTtl = 60 * 1000
    const isInferiorToMinTtl = ttlInMs < minTtl
    if (!this.config.ignoreMinTtlError && isInferiorToMinTtl) {
      throw new Error('Cloudflare only supports ttl superior to 60 seconds')
    }

    const ttl = isInferiorToMinTtl ? minTtl : ttlInMs
    return ttl / 1000
  }

  /**
   * Returns a new instance of the driver namespaced
   */
  namespace(namespace: string) {
    return new CloudflareKv({
      ...this.config,
      prefix: this.joinPrefixes(this.getPrefix(), namespace),
    })
  }

  /**
   * Get a value from the cache
   */
  async get(key: string) {
    const encodedKey = encodeURIComponent(this.getItemKey(key))
    const result = await this.#got
      .get(`values/${encodedKey}`)
      .text()
      .catch((error) => {
        if (error.response.statusCode === 404) {
          return undefined
        }

        throw error
      })

    return result as string | undefined
  }

  /**
   * Get many values from the cache
   * Will return an array of objects with `key` and `value` properties
   * If a value is not found, `value` will be undefined
   *
   * Note that cloudflare kv does not support bulk get.
   * so we have to do it one by one
   */
  getMany(keys: string[]) {
    return Promise.all(keys.map(async (key) => ({ key, value: await this.get(key) })))
  }

  /**
   * Get the value of a key and delete it
   *
   * Returns the value if the key exists, undefined otherwise
   */
  async pull(key: string) {
    const value = await this.get(key)
    if (value === undefined) {
      return undefined
    }

    await this.delete(key)
    return value
  }

  /**
   * Put a value in the cache
   * Returns true if the value was set, false otherwise
   */
  async set(key: string, value: string, ttl?: number | undefined) {
    ttl = this.#getTtl(ttl)

    const encodedKey = encodeURIComponent(this.getItemKey(key))
    const result = await this.#got
      .put(`values/${encodedKey}`, {
        searchParams: { expiration_ttl: ttl },
        body: value,
      })
      .json<{ success: boolean }>()

    return result.success === true
  }

  /**
   * Set many values in the cache
   */
  async setMany(values: KeyValueObject[], ttl?: number | undefined) {
    ttl = this.#getTtl(ttl)

    const result = await this.#got
      .put(`bulk`, {
        json: values.map((value) => ({
          key: this.getItemKey(value.key),
          value: value.value,
          expiration_ttl: ttl,
        })),
      })
      .json<{ success: boolean }>()

    return result.success === true
  }

  /**
   * Check if a key exists in the cache
   */
  async has(key: string) {
    const item = await this.get(key)
    return item !== undefined
  }

  /**
   * Remove all items from the cache
   */
  async clear() {
    const result = await this.#got
      .get(`keys`, { searchParams: { prefix: this.getPrefix() } })
      .json<{ result: { name: string }[] }>()

    await this.deleteMany(
      result.result.map((item) => item.name),
      false
    )
  }

  /**
   * Delete a key from the cache
   * Returns true if the key was deleted, false otherwise
   */
  async delete(key: string) {
    const encodedItemKey = encodeURIComponent(this.getItemKey(key))
    const result = await this.#got.delete(`values/${encodedItemKey}`).json<{ success: boolean }>()

    return result.success === true
  }

  /**
   * Delete multiple keys from the cache
   */
  async deleteMany(keys: string[], addPrefix = true) {
    if (addPrefix) keys = keys.map((key) => this.getItemKey(key))

    /**
     * Make chunks of 10K items since cloudflare only allows 10K items per request
     */
    const chunks = [...chunkify(keys, 10000)]

    /**
     * Delete each chunk in parallel
     */
    const results = await Promise.all(
      chunks.map(async (chunk) => {
        const result = await this.#got.delete(`bulk`, { json: chunk }).json<{ success: boolean }>()
        return result.success === true
      })
    )

    return results.every((result) => result === true)
  }

  /**
   * Closes the connection to the cache
   */
  disconnect() {}
}
