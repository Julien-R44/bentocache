import { LRUCache } from 'lru-cache'
import { bytes } from '@julr/utils/string/bytes'
import { InvalidArgumentsException } from '@poppinss/exception'

import { BaseDriver } from './base_driver.js'
import type {
  CreateDriverResult,
  HashOperations,
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

import { HashSupportLevel } from '../types/main.js'

/**
 * A memory caching driver
 */
export class MemoryDriver extends BaseDriver implements L1CacheDriver {
  type = 'l1' as const
  #cache: LRUCache<string, string>
  #hashes: Map<string, Map<string, any>>
  declare config: MemoryConfig

  constructor(
    config: MemoryConfig & {
      cacheInstance?: LRUCache<string, string>
      hashes?: Map<string, Map<string, any>>
    } = {},
  ) {
    super(config)
    this.#hashes = config.hashes ?? new Map()

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
      ttlAutopurge: false,
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
      hashes: this.#hashes,
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
   * Remove all items from the cache
   */
  async clear() {
    for (const key of this.#cache.keys()) {
      if (key.startsWith(`${this.prefix}:`)) {
        this.#cache.delete(key)
      }
    }

    for (const key of this.#hashes.keys()) {
      if (key.startsWith(`${this.prefix}:`)) {
        this.#hashes.delete(key)
      }
    }
  }

  /**
   * Delete a key from the cache
   * Returns true if the key was deleted, false otherwise
   */
  delete(key: string) {
    const itemKey = this.getItemKey(key)
    this.#hashes.delete(itemKey)
    return this.#cache.delete(itemKey)
  }

  /**
   * Delete multiple keys from the cache
   */
  deleteMany(keys: string[]) {
    if (keys.length === 0) return true
    for (const key of keys) this.delete(key)
    return true
  }

  async disconnect() { }

  /**
   * Hash operations
   */
  readonly hash: HashOperations<false> = {
    supportLevel: HashSupportLevel.Simulated,

    get: (key, field) => {
      return this.#hashes.get(this.getItemKey(key))?.get(field)
    },

    set: (key, field, value, ttl) => {
      const itemKey = this.getItemKey(key)
      if (!this.#hashes.has(itemKey)) {
        this.#hashes.set(itemKey, new Map())
      }

      this.#hashes.get(itemKey)!.set(field, value)

      // Note: TTL is not supported for simulated hashes in this simple implementation
      // If we wanted to support it, we'd need to track expiry separately
    },

    getAll: (key) => {
      const hash = this.#hashes.get(this.getItemKey(key))
      return hash ? Object.fromEntries(hash) : undefined
    },

    keys: (key) => {
      const hash = this.#hashes.get(this.getItemKey(key))
      return hash ? Array.from(hash.keys()) : undefined
    },

    delete: (key, field) => {
      const hash = this.#hashes.get(this.getItemKey(key))
      if (!hash) return false

      const result = hash.delete(field)
      if (hash.size === 0) {
        this.#hashes.delete(this.getItemKey(key))
      }
      return result
    },
  }
}
