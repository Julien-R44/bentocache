/*
 * @adonisjs/cache
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import is from '@sindresorhus/is'
import { Mutex } from 'async-mutex'

import debug from '../debug.js'
import { resolveTtl } from '../helpers.js'
import { CacheItem } from '../cache_item.js'
import { BaseProvider } from './base_provider.js'
import { CacheHit } from '../events/cache_hit.js'
import { CacheMiss } from '../events/cache_miss.js'
import { CacheOptions, type CacheOptions as CacheItemOptions } from '../cache_options.js'
import { CacheDeleted } from '../events/cache_deleted.js'
import { CacheWritten } from '../events/cache_written.js'
import { CacheCleared } from '../events/cache_cleared.js'
import type { CacheProvider, CacheProviderOptions } from '../types/provider.js'
import type {
  CacheDriver,
  CachedValue,
  GetOrSetOptions,
  RawCacheOptions,
  TTL,
  Factory,
  KeyValueObject,
} from '../types/main.js'
import { RemoteCache } from '../remote_cache.js'

export class Cache extends BaseProvider implements CacheProvider {
  #localDriver: CacheDriver
  #remoteDriver?: CacheDriver
  #remoteCache?: RemoteCache

  constructor(name: string, options: CacheProviderOptions) {
    super(name, options)

    this.#localDriver = options.localDriver
    this.#remoteDriver = options.remoteDriver
    if (this.#remoteDriver) {
      this.#remoteCache = new RemoteCache(this.#remoteDriver)
    }
  }

  #resolveDefaultValue(defaultValue?: Factory) {
    return is.function_(defaultValue) ? defaultValue() : defaultValue ?? undefined
  }

  /**
   * Set a value in the cache
   */
  async #set(key: string, item: any, ttl?: number) {
    const serializedValue = this.serialize(item)
    const result = await this.#localDriver.set(key, serializedValue, ttl)
    if (result) {
      this.emit(new CacheWritten(key, item.value, this.name))
    }

    return result
  }

  /**
   * Get or create a new lock for the given key
   */
  #getOrCreateLock(key: string) {
    let lock = this.locks.get(key)
    if (!lock) {
      lock = new Mutex()
      this.locks.set(key, lock)
    }

    return lock
  }

  /**
   * Returns a new instance of the driver namespaced
   */
  namespace(namespace: string) {
    return new Cache(this.name, {
      localDriver: this.#localDriver.namespace(namespace),
      emitter: this.emitter,
      ttl: this.defaultTtl,
      serializer: this.serializer,
      gracefulRetain: this.gracefulRetain,
    })
  }

  get<T = any>(key: string): Promise<T | undefined | null>
  get<T = any>(key: string, defaultValue: Factory<T>): Promise<T>
  async get<T = any>(key: string, defaultValue?: Factory<T>): Promise<T | undefined | null> {
    let localCacheItem: CacheItem | undefined
    let remoteCacheItem: CacheItem | undefined

    const localItem = await this.#localDriver.get(key)

    /**
     * Explicitly check for `undefined` as the value can be stored as `null`
     */
    if (localItem !== undefined) {
      localCacheItem = CacheItem.fromDriver(key, localItem)

      /**
       * Item found in local cache and is not logically expired. So we can
       * return it right away
       */
      if (!localCacheItem.isLogicallyExpired()) {
        this.emit(new CacheHit(key, localCacheItem.getValue(), this.name))
        return localCacheItem.getValue()
      }

      /**
       * Item is logically expired, but we can still return it, if graceful
       * retain is enabled. Keep the item around and maybe return it later
       */
      if (this.gracefulRetain.enabled) {
        //
      }
    }

    /**
     * Item wasn't found in the local cache. So let's try
     * with the remote cache
     */
    if (this.#remoteCache) {
      const remoteItem = await this.#remoteCache.get(key, this.defaultCacheOptions())

      /**
       * Explicitly check for `undefined` as the value can be stored as `null`
       * in the remote cache
       */
      if (remoteItem !== undefined) {
        /**
         * Item found in remote cache and is not logically expired. So we can
         * save it to the local cache and return it right away
         */
        if (!remoteItem.isLogicallyExpired()) {
          await this.#localDriver.set(key, remoteItem.serialize())
          this.emit(new CacheHit(key, remoteItem.getValue(), this.name))
          return remoteItem.getValue()
        }

        /**
         * Item is logically expired. If graceful retain is not enabled, then
         * its a cache miss
         */
        if (!this.gracefulRetain.enabled) {
          this.emit(new CacheMiss(key, this.name))
          return this.#resolveDefaultValue(defaultValue)
        }
      }
    }

    if (this.gracefulRetain.enabled) {
      if (remoteCacheItem) {
        await this.#localDriver.set(key, remoteCacheItem.serialize())
        this.emit(new CacheHit(key, remoteCacheItem.serialize(), this.name))
        return remoteCacheItem.getValue()
      }

      if (localCacheItem) {
        this.emit(new CacheHit(key, localCacheItem.serialize(), this.name))
        return localCacheItem.getValue()
      }
    }

    this.emit(new CacheMiss(key, this.name))
    return this.#resolveDefaultValue(defaultValue)
  }

  /**
   * Get many values from the cache
   * Will return an array of objects with `key` and `value` properties
   * If a value is not found, `value` will be undefined
   */
  async getMany<T>(keys: string[], defaultValues?: Factory<T[]>): Promise<KeyValueObject<T>[]> {
    const result = await this.#localDriver.getMany(keys)
    const resolvedDefaultValues = this.#resolveDefaultValue(defaultValues)

    const deserializedValuesPromises = keys.map(async (key, index) => {
      if (is.nullOrUndefined(result[index].value)) {
        this.emit(new CacheMiss(key, this.name))
        return { key, value: resolvedDefaultValues?.[index] }
      }

      const value = await this.deserialize(result[index].value!)
      this.emit(new CacheHit(key, value, this.name))

      return { key, value }
    })

    return await Promise.all(deserializedValuesPromises)
  }

  /**
   * Set a value in the cache
   * Returns true if the value was set, false otherwise
   */
  async set(key: string, value: any, rawOptions?: RawCacheOptions) {
    const options = new CacheOptions(rawOptions, {
      ttl: this.defaultTtl,
      gracefulRetain: this.gracefulRetain,
      earlyExpiration: this.earlyExpiration,
    })

    const item = this.serialize({
      value: value,
      logicalExpiration: options.logicalTtlFromNow(),
      earlyExpiration: options.earlyExpireTtlFromNow(),
    })

    if (this.#localDriver) {
      await this.#localDriver.set(key, item, options.physicalTtl)
    }

    if (this.#remoteDriver) {
      await this.#remoteCache!.set(key, item, options.physicalTtl)
    }

    this.emit(new CacheWritten(key, value, this.name))
    return true
  }

  /**
   * Set a value in the cache forever
   * Returns true if the value was set, false otherwise
   */
  async setForever<T>(key: string, value: T) {
    return this.#set(key, { value })
  }

  /**
   * Set many values in the cache
   */
  async setMany(values: { key: string; value: CachedValue }[], ttl?: number) {
    const serializedValuesPromises = values.map(async (value) => ({
      key: value.key,
      value: await this.serialize(value.value),
    }))

    const serializedValues = await Promise.all(serializedValuesPromises)

    const result = await this.#localDriver.setMany(serializedValues, resolveTtl(ttl))
    if (result) {
      values.forEach((value) => this.emit(new CacheWritten(value.key, value.value!, this.name)))
    }

    return result
  }

  async #earlyExpirationRefresh(key: string, factory: Factory, options: CacheItemOptions) {
    let lock = this.#getOrCreateLock(key)

    /**
     * If lock is already acquired, then just exit. We only want to run
     * the factory once, in background.
     */
    if (lock.isLocked()) {
      return
    }

    await lock.runExclusive(async () => {
      const cacheItem = {
        value: await factory(),
        logicalExpiration: options.logicalTtlFromNow(),
        earlyExpiration: options.earlyExpireTtlFromNow(),
      }

      await this.#set(key, cacheItem, options.physicalTtl)
      debug('EARLY EXPIRATION REFRESH: set value in cache %o', {
        cacheItem: cacheItem,
        physical: options.physicalTtl,
      })
    })
  }

  async #getOrSet(key: string, factory: Factory, options: CacheItemOptions) {
    let localCacheItem: CacheItem | undefined
    let localCacheItemLogicallyExpired = false

    let remoteCacheItem: CacheItem | undefined

    /**
     * First we check the local cache
     */
    if (this.#localDriver) {
      const localItem = await this.#localDriver.get(key)

      if (localItem !== undefined) {
        localCacheItem = CacheItem.fromDriver(key, localItem)
        localCacheItemLogicallyExpired = localCacheItem.isLogicallyExpired()
      }
    }

    /**
     * We found the value in the local cache and it's not logically expired
     */
    if (localCacheItem && !localCacheItemLogicallyExpired) {
      /**
       * Check if we need to early refresh the value
       */
      if (localCacheItem.isEarlyExpired()) {
        this.#earlyExpirationRefresh(key, factory, options)
      }

      /**
       * Returns the value
       */
      this.emit(new CacheHit(key, localCacheItem.getValue(), this.name))
      debug('getOrSet(): value found in local cache for key "%s"', key)
      return localCacheItem.getValue()
    }

    /**
     * Since we didnt find the value in the local cache,
     * we check the remote cache
     */
    if (this.#remoteCache) {
      remoteCacheItem = await this.#remoteCache.get(key, options)

      /**
       * We found the value in the remote cache and it's not logically expired
       * We need to set it in the local cache
       */
      if (remoteCacheItem && !remoteCacheItem.isLogicallyExpired()) {
        await this.#localDriver?.set(key, remoteCacheItem.serialize(), options.physicalTtl)
        this.emit(new CacheHit(key, remoteCacheItem.getValue(), this.name))
        return remoteCacheItem.getValue()
      }
    }

    /**
     * We didnt find the value in the local or remote cache
     * We need to run the factory and set the value in the different caches
     */
    const lock = this.#getOrCreateLock(key)
    const release = await lock.acquire()

    let staleItem: CacheItem | undefined
    let newCacheItem: any

    try {
      /**
       * We have to check again if the value is in the cache
       * since another request might have resolved it while
       * we were waiting for the lock
       */
      const doubleCheckedValue = await this.#localDriver.get(key)
      if (doubleCheckedValue !== undefined) {
        staleItem = CacheItem.fromDriver(key, doubleCheckedValue)
        if (!staleItem.isLogicallyExpired()) {
          this.emit(new CacheHit(key, staleItem.getValue(), this.name))
          debug('getOrSet(): value found in cache for key "%s"', key)
          return staleItem.getValue()
        }
      }

      /**
       * Execute the factory and prepare the cache item to store
       */
      newCacheItem = {
        value: await factory(),
        logicalExpiration: options.logicalTtlFromNow(),
        earlyExpiration: options.earlyExpireTtlFromNow(),
      }

      /**
       * Store in the remote cache if available
       */
      if (this.#remoteDriver) {
        await this.#remoteDriver.set(key, this.serialize(newCacheItem), options.physicalTtl)
      }

      /**
       * Store in the local cache if available
       */
      if (this.#localDriver) {
        await this.#localDriver.set(key, this.serialize(newCacheItem), options.physicalTtl)
      }

      debug('getOrSet(): set value in cache %o', {
        cacheItem: newCacheItem,
        physicalTtl: options.physicalTtl,
      })

      return newCacheItem.value
    } catch (error) {
      debug('getOrSet(): error while calling factory for key "%s"', key)

      /**
       * If the factory failed and graceful retain is enabled, we have to
       * return the old cached value if it exists.
       */
      if (options.isGracefulRetainEnabled) {
        debug('getOrSet(): graceful retain is enabled for key "%s"', key)
        if (staleItem) {
          return staleItem.getValue()
        }
      }

      throw error
    } finally {
      release()
      this.locks.delete(key)
    }
  }

  /**
   * Retrieve an item from the cache if it exists, otherwise store the value
   * provided by the factory and return it
   */
  async getOrSet<T>(
    key: string,
    ttlOrFactory: TTL | Factory<T>,
    factoryOrOptions?: Factory<T> | GetOrSetOptions,
    maybeOptions?: GetOrSetOptions
  ): Promise<T> {
    let { factory, options } = this.resolveGetSetOptions(
      ttlOrFactory,
      factoryOrOptions,
      maybeOptions
    )

    return this.#getOrSet(key, factory, options)
  }

  /**
   * Retrieve an item from the cache if it exists, otherwise store the value
   * provided by the factory forever and return it
   */
  async getOrSetForever<T>(
    key: string,
    factory: () => CachedValue | Promise<CachedValue>
  ): Promise<T> {
    return this.#getOrSet(key, factory, this.foreverCacheOptions())
  }

  /**
   * Check if a key exists in the cache
   */
  async has(key: string) {
    return this.#localDriver.has(key)
  }

  /**
   * Check if key is missing in the cache
   */
  async missing(key: string) {
    const hasKey = await this.#localDriver.has(key)
    return !hasKey
  }

  /**
   * Get the value of a key and delete it
   *
   * Returns the value if the key exists, undefined otherwise
   */
  async pull<T = any>(key: string): Promise<T | undefined | null> {
    const result = await this.#localDriver.pull(key)
    const item = is.undefined(result) ? undefined : await this.deserialize(result)

    if (result) {
      this.emit(new CacheHit(key, item.value, this.name))
      this.emit(new CacheDeleted(key, this.name))
    }

    return item
  }

  /**
   * Delete a key from the cache
   * Returns true if the key was deleted, false otherwise
   */
  async delete(key: string): Promise<boolean> {
    const result = await this.#localDriver.delete(key)

    if (result) {
      this.emit(new CacheDeleted(key, this.name))
    }

    return result
  }

  /**
   * Delete multiple keys from the cache
   */
  async deleteMany(keys: string[]): Promise<boolean> {
    const result = await this.#localDriver.deleteMany(keys)
    if (result) {
      keys.forEach((key) => this.emit(new CacheDeleted(key, this.name)))
    }

    return result
  }

  /**
   * Remove all items from the cache
   */
  async clear() {
    await Promise.all([this.#localDriver.clear(), this.#remoteDriver?.clear()])
    this.emit(new CacheCleared(this.name))
  }

  /**
   * Closes the connection to the cache
   */
  async disconnect() {
    await Promise.all([this.#localDriver.disconnect(), this.#remoteDriver?.disconnect()])
  }
}
