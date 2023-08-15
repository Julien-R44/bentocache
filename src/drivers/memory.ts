/*
 * @blizzle/bentocache
 *
 * (c) Blizzle
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import TTLCache from '@isaacs/ttlcache'

import { BaseDriver } from './base_driver.js'
import type { CacheDriver, MemoryConfig as MemoryConfig } from '../types/main.js'

/**
 * A memory caching driver
 *
 * Will really remove entries as soon as they expire
 * ( using a setTimeout ) unlike the Lru driver
 */
export class Memory extends BaseDriver implements CacheDriver {
  #cache: TTLCache<string, string>
  declare config: MemoryConfig

  constructor(config: MemoryConfig & { cacheInstance?: TTLCache<string, string> }) {
    super(config)

    if (config.cacheInstance) {
      this.#cache = config.cacheInstance
    } else {
      this.#cache = new TTLCache({ max: config.maxSize, checkAgeOnGet: true })
    }
  }

  /**
   * Returns a new instance of the driver namespaced
   */
  namespace(namespace: string) {
    return new Memory({
      ...this.config,
      cacheInstance: this.#cache,
      prefix: this.createNamespacePrefix(namespace),
    })
  }

  /**
   * Get a value from the cache
   */
  get(key: string) {
    return this.#cache.get(this.getItemKey(key))
  }

  /**
   * Get the value of a key and delete it
   *
   * Returns the value if the key exists, undefined otherwise
   */
  pull(key: string) {
    if (!this.has(key)) return undefined

    const value = this.get(key)
    this.delete(key)
    return value
  }

  /**
   * Put a value in the cache
   * Returns true if the value was set, false otherwise
   */
  set(key: string, value: string, ttl?: number) {
    this.#cache.set(this.getItemKey(key), value, { ttl: ttl ?? Number.POSITIVE_INFINITY })
    return true
  }

  /**
   * Returns the remaining ttl of a key
   */
  getRemainingTtl(key: string) {
    return this.#cache.getRemainingTTL(this.getItemKey(key))
  }

  /**
   * Check if a key exists in the cache
   */
  has(key: string) {
    return this.#cache.has(this.getItemKey(key))
  }

  /**
   * Remove all items from the cache
   */
  async clear() {
    // @ts-expect-error. keys() and entries() values doesn't
    // return keys that are stored forever. So we need
    // to use this internal `data` property
    // See https://github.com/isaacs/ttlcache/issues/27
    for (const [key] of this.#cache.data) {
      if (key.startsWith(this.prefix)) {
        this.#cache.delete(key)
      }
    }
  }

  /**
   * Delete a key from the cache
   * Returns true if the key was deleted, false otherwise
   */
  delete(key: string) {
    return this.#cache.delete(this.getItemKey(key))
  }

  /**
   * Delete multiple keys from the cache
   */
  deleteMany(keys: string[]) {
    for (const key of keys) this.delete(key)
    return true
  }

  async disconnect() {}
}
