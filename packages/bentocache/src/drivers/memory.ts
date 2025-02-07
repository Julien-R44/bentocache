import { LRUCache } from 'lru-cache'
import { bytes } from '@julr/utils/string/bytes'
import { InvalidArgumentsException } from '@poppinss/utils'

import { BaseDriver } from './base_driver.js'
import type {
  CreateDriverResult,
  L1CacheDriver,
  MemoryConfig as MemoryConfig,
} from '../types/main.js'

/**
 * Create a new memory driver
 */
export function memoryDriver(options: MemoryConfig = {}): CreateDriverResult<MemoryDriver> {
  return {
    options,
    factory: (config: MemoryConfig) => new MemoryDriver(config),
  }
}

/**
 * A memory caching driver
 */
export class MemoryDriver extends BaseDriver implements L1CacheDriver {
  type = 'l1' as const
  #cache: LRUCache<string, string>
  declare config: MemoryConfig

  constructor(config: MemoryConfig & { cacheInstance?: LRUCache<string, string> } = {}) {
    super(config)

    if (config.cacheInstance) {
      this.#cache = config.cacheInstance
      return
    }

    if (config.serialize === false && (config.maxEntrySize || config.maxSize)) {
      throw new InvalidArgumentsException(
        'Cannot use maxSize or maxEntrySize when serialize is set to `false`',
      )
    }

    this.#cache = new LRUCache({
      max: config.maxItems ?? 1000,
      maxEntrySize: config.maxEntrySize ? bytes.parse(config.maxEntrySize) : undefined,
      ttlAutopurge: true,
      ...(config.maxSize
        ? {
            maxSize: config.maxSize ? bytes.parse(config.maxSize) : undefined,
            sizeCalculation: (value) => Buffer.byteLength(value, 'utf-8'),
          }
        : {}),
    })
  }

  /**
   * Returns a new instance of the driver namespaced
   */
  namespace(namespace: string) {
    return new MemoryDriver({
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
    this.#cache.set(this.getItemKey(key), value, { ttl })
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
    for (const key of this.#cache.keys()) {
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
