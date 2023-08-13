/*
 * @quakjs/bentocache
 *
 * (c) Quak
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import QuickLRU from 'quick-lru'

import { BaseDriver } from './base_driver.js'
import type { CacheDriver, MemoryConfig as MemoryConfig } from '../types/main.js'

/**
 * A memory caching driver using LRU algorithm
 *
 * Notes that expired entries will not be deleted until they are accessed
 * using this driver. If you need something primary based on time, use
 * the Memory driver instead
 */
export class MemoryLru extends BaseDriver implements CacheDriver {
  #lru: QuickLRU<string, string>
  declare config: MemoryConfig

  constructor(config: MemoryConfig & { lruInstance?: QuickLRU<string, string> }) {
    super(config)

    if (config.lruInstance) {
      this.#lru = config.lruInstance
      return
    }

    this.#lru = new QuickLRU({ maxSize: config.maxSize ?? 1000 })
  }

  /**
   * Returns a new instance of the driver namespaced
   */
  namespace(namespace: string) {
    return new MemoryLru({
      ...this.config,
      lruInstance: this.#lru,
      prefix: this.createNamespacePrefix(namespace),
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
    for (const key of this.#lru.keys()) {
      if (key.startsWith(this.prefix)) {
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
    for (const key of keys) this.delete(key)
    return true
  }

  async disconnect() {}
}
