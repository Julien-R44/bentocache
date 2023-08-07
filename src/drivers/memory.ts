/*
 * @adonisjs/cache
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import QuickLRU from 'quick-lru'

import { BaseDriver } from './base_driver.js'
import type { CacheDriver, CachedValue, MemoryConfig as MemoryConfig } from '../types/main.js'

export class Memory extends BaseDriver implements CacheDriver {
  #lru: QuickLRU<string, CachedValue>
  declare config: MemoryConfig

  constructor(config: MemoryConfig & { lruInstance?: QuickLRU<string, CachedValue> }) {
    super(config)

    if (config.lruInstance) {
      this.#lru = config.lruInstance
      return
    }

    this.#lru = new QuickLRU({ maxSize: config.maxSize ?? 1000, maxAge: config.ttl })
  }

  /**
   * Returns a new instance of the driver namespaced
   */
  namespace(namespace: string) {
    return new Memory({
      ...this.config,
      lruInstance: this.#lru,
      prefix: this.joinPrefixes(this.getPrefix(), namespace),
    })
  }

  /**
   * Get a value from the cache
   */
  get(key: string) {
    return this.#lru.get(this.getItemKey(key))
  }

  /**
   * Get the value of a key and delete it
   *
   * Returns the value if the key exists, undefined otherwise
   */
  pull(key: string) {
    if (!this.has(key)) {
      return undefined
    }

    const value = this.get(key)
    this.delete(key)
    return value
  }

  /**
   * Put a value in the cache
   * Returns true if the value was set, false otherwise
   */
  set<T extends CachedValue>(key: string, value: T, ttl?: number) {
    this.#lru.set(this.getItemKey(key), value, { maxAge: ttl ?? Number.POSITIVE_INFINITY })
    return true
  }

  /**
   * Check if a key exists in the cache
   */
  has(key: string) {
    return this.#lru.has(this.getItemKey(key))
  }

  /**
   * Remove all items from the cache
   */
  async clear() {
    const keys = [...this.#lru.keys()]
    for (const key of keys) {
      if (key.startsWith(this.getPrefix())) {
        this.#lru.delete(key)
      }
    }
  }

  /**
   * Delete a key from the cache
   * Returns true if the key was deleted, false otherwise
   */
  delete(key: string) {
    return this.#lru.delete(this.getItemKey(key))
  }

  /**
   * Delete multiple keys from the cache
   */
  deleteMany(keys: string[]) {
    for (const key of keys) {
      this.delete(key)
    }
    return true
  }

  async disconnect() {}
}

export function memoryDriver(options: MemoryConfig) {
  return {
    local: {
      options,
      factory: (config: MemoryConfig) => new Memory(config),
    },
  }
}
