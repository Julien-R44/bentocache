/*
 * @adonisjs/cache
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { Mutex } from 'async-mutex'

import type { CacheItem } from './cache_item.js'
import { BaseProvider } from './base_cache.js'
import { CacheHit } from './events/cache_hit.js'
import { CacheMiss } from './events/cache_miss.js'
import { type CacheItemOptions as CacheItemOptions } from './cache_options.js'
import { CacheDeleted } from './events/cache_deleted.js'
import { CacheWritten } from './events/cache_written.js'
import { CacheCleared } from './events/cache_cleared.js'
import type { CacheProvider, CacheProviderOptions } from './types/provider.js'
import type { Logger } from './types/main.js'
import {
  type CacheDriver,
  type CachedValue,
  type GetOrSetOptions,
  type RawCacheOptions,
  type TTL,
  type Factory,
  type BusDriver,
  CacheBusMessageType,
} from './types/main.js'
import { RemoteCache } from './remote_cache.js'
import { LocalCache } from './local_cache.js'
import { Bus } from './bus/bus.js'

export class Cache extends BaseProvider implements CacheProvider {
  #localDriver?: CacheDriver
  #localCache?: LocalCache

  #remoteDriver?: CacheDriver
  #remoteCache?: RemoteCache
  #bus?: Bus
  #busDriver?: BusDriver
  #logger: Logger

  constructor(name: string, options: CacheProviderOptions) {
    super(name, options)

    this.#localDriver = options.localDriver
    this.#remoteDriver = options.remoteDriver
    this.#busDriver = options.busDriver
    this.#logger = options.logger

    if (this.#localDriver) {
      this.#localCache = new LocalCache(this.#localDriver, this.#logger)
    }

    if (this.#remoteDriver) {
      this.#remoteCache = new RemoteCache(this.#remoteDriver, this.#logger)
    }

    if (this.#busDriver && this.#localCache) {
      this.#bus = new Bus(this.#busDriver, this.#localCache, this.#logger, this.emitter)
      this.#bus.subscribe()
    }
  }

  #resolveDefaultValue(defaultValue?: Factory) {
    return typeof defaultValue === 'function' ? defaultValue() : defaultValue ?? undefined
  }

  /**
   * Set a value in the cache
   */
  async #set(key: string, value: any, options: CacheItemOptions) {
    const item = this.serialize({
      value: value,
      logicalExpiration: options.logicalTtlFromNow(),
      earlyExpiration: options.earlyExpireTtlFromNow(),
    })

    if (this.#localCache) {
      await this.#localCache.set(key, item, options)
    }

    if (this.#remoteCache) {
      await this.#remoteCache!.set(key, item, options)
    }

    if (this.#bus) {
      await this.#bus.publish({ type: CacheBusMessageType.Set, keys: [key] })
    }

    this.emit(new CacheWritten(key, value, this.name))
    return true
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
      localDriver: this.#localDriver?.namespace(namespace),
      remoteDriver: this.#remoteDriver?.namespace(namespace),
      logger: this.#logger,
      emitter: this.emitter,
      ttl: this.defaultTtl,
      serializer: this.serializer,
      gracefulRetain: this.gracefulRetain,
    })
  }

  get<T = any>(key: string): Promise<T | undefined | null>
  get<T = any>(key: string, defaultValue: Factory<T>): Promise<T>
  get<T = any>(key: string, defaultValue?: Factory<T>, options?: GetOrSetOptions): Promise<T>
  async get<T = any>(
    key: string,
    defaultValue?: Factory<T>,
    rawOptions?: GetOrSetOptions
  ): Promise<T | undefined | null> {
    const options = this.defaultCacheOptions.cloneWith(rawOptions)

    let localItem: CacheItem | undefined
    let remoteItem: CacheItem | undefined

    if (this.#localCache) {
      localItem = await this.#localCache.get(key, options)

      /**
       * Explicitly check for `undefined` as the value can be stored as `null`
       */
      if (localItem !== undefined) {
        /**
         * Item found in local cache and is not logically expired. So we can
         * return it right away
         */
        if (!localItem.isLogicallyExpired()) {
          this.emit(new CacheHit(key, localItem.getValue(), this.name))
          return localItem.getValue()
        }
      }
    }

    /**
     * Item wasn't found in the local cache. So let's try
     * with the remote cache
     */
    if (this.#remoteCache) {
      remoteItem = await this.#remoteCache.get(key, this.defaultCacheOptions)

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
          await this.#localCache?.set(key, remoteItem.serialize(), options)
          this.emit(new CacheHit(key, remoteItem.getValue(), this.name))
          return remoteItem.getValue()
        }

        /**
         * Item is logically expired. If graceful retain is not enabled, then
         * its a cache miss
         */
        if (!options.isGracefulRetainEnabled) {
          this.emit(new CacheMiss(key, this.name))
          return this.#resolveDefaultValue(defaultValue)
        }
      }
    }

    if (options.isGracefulRetainEnabled) {
      if (remoteItem) {
        await this.#localCache?.set(key, remoteItem.serialize(), options)
        this.emit(new CacheHit(key, remoteItem.serialize(), this.name))
        return remoteItem.getValue()
      }

      if (localItem) {
        this.emit(new CacheHit(key, localItem.serialize(), this.name))
        return localItem.getValue()
      }
    }

    this.emit(new CacheMiss(key, this.name))
    return this.#resolveDefaultValue(defaultValue)
  }

  /**
   * Set a value in the cache
   * Returns true if the value was set, false otherwise
   */
  async set(key: string, value: any, rawOptions?: RawCacheOptions) {
    const options = this.defaultCacheOptions.cloneWith(rawOptions)
    return this.#set(key, value, options)
  }

  /**
   * Set a value in the cache forever
   * Returns true if the value was set, false otherwise
   */
  async setForever<T>(key: string, value: T, rawOptions?: RawCacheOptions) {
    const options = this.defaultCacheOptions.cloneWith({ ttl: null, ...rawOptions })
    return this.#set(key, value, options)
  }

  /**
   * Refreshes the value of a cache
   */
  async #earlyExpirationRefresh(key: string, factory: Factory, options: CacheItemOptions) {
    this.#logger.debug({ key, name: this.name, opId: options.id }, 'try to early refresh')
    let lock = this.#getOrCreateLock(key)

    /**
     * If lock is already acquired, then just exit. We only want to run
     * the factory once, in background.
     */
    if (lock.isLocked()) {
      return
    }

    await lock.runExclusive(async () => {
      this.#logger.trace({ key, cache: this.name, opId: options.id }, 'acquired lock')
      await this.#set(key, await factory(), options)
    })
  }

  async #getOrSet(key: string, factory: Factory, options: CacheItemOptions) {
    let localCacheItem: CacheItem | undefined

    let remoteCacheItem: CacheItem | undefined

    /**
     * First we check the local cache
     */
    localCacheItem = await this.#localCache?.get(key, options)

    /**
     * We found the value in the local cache and it's not logically expired
     */
    if (localCacheItem && !localCacheItem.isLogicallyExpired()) {
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
      this.#logger.trace({ key, cache: this.name, opId: options.id }, 'local cache hit')
      return localCacheItem.getValue()
    }

    /**
     * We didn't find the value in the local or remote cache
     * We need to run the factory and set the value in the different caches
     */
    const lock = this.#getOrCreateLock(key)

    return await lock
      .runExclusive(async () => {
        this.#logger.trace({ key, cache: this.name, opId: options.id }, 'acquired lock')

        /**
         * We have to check again if the value is in the cache
         * since another request might have resolved it while
         * we were waiting for the lock
         */
        localCacheItem = await this.#localCache?.get(key, options)
        if (localCacheItem && !localCacheItem.isLogicallyExpired()) {
          this.emit(new CacheHit(key, localCacheItem.getValue(), this.name))
          this.#logger.trace(
            { key, cache: this.name, opId: options.id },
            'local cache hit after lock'
          )
          return localCacheItem.getValue()
        }

        /**
         * Since we didn't find the value in the local cache,
         * we check the remote cache
         */
        remoteCacheItem = await this.#remoteCache?.get(key, options)

        /**
         * We found the value in the remote cache and it's not logically expired
         * We need to set it in the local cache
         */
        if (remoteCacheItem && !remoteCacheItem.isLogicallyExpired()) {
          this.#logger.trace({ key, cache: this.name, opId: options.id }, 'remote cache hit')

          /**
           * Set the value in the local cache
           */
          await this.#localCache?.set(key, remoteCacheItem.serialize(), options)

          /**
           * Returns the value
           */
          this.emit(new CacheHit(key, remoteCacheItem.getValue(), this.name))
          return remoteCacheItem.getValue()
        }

        /**
         * Execute the factory and prepare the cache item to store
         */
        const newCacheItem = {
          value: await factory(),
          logicalExpiration: options.logicalTtlFromNow(),
          earlyExpiration: options.earlyExpireTtlFromNow(),
        }

        /**
         * Store in the remote cache if available
         */
        await this.#remoteCache?.set(key, this.serialize(newCacheItem), options)

        /**
         * Store in the local cache if available
         */
        await this.#localCache?.set(key, this.serialize(newCacheItem), options)

        /**
         * Emit invalidation through the bus
         */
        await this.#bus?.publish({ keys: [key], type: CacheBusMessageType.Set })

        /**
         * Emit cache:miss and cache:written events
         */
        this.emit(new CacheMiss(key, this.name))
        this.emit(new CacheWritten(key, newCacheItem.value, this.name))

        /**
         * Return the value
         */
        this.#logger.trace({ key, cache: this.name, opId: options.id }, 'cache miss')
        return newCacheItem.value
      })
      .catch((error) => {
        this.#logger.trace({ key, cache: this.name, opId: options.id }, 'factory error')

        const staleItem = localCacheItem ?? remoteCacheItem

        /**
         * If the factory failed and graceful retain is enabled, we have to
         * return the old cached value if it exists.
         */
        if (options.isGracefulRetainEnabled && staleItem) {
          this.#logger.trace({ key, cache: this.name, opId: options.id }, 'returns stale value')
          return staleItem.getValue()
        }

        throw error
      })
      .finally(() => {
        this.locks.delete(key)
      })
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
    factory: () => CachedValue | Promise<CachedValue>,
    rawOptions?: GetOrSetOptions
  ): Promise<T> {
    /**
     * Create a CacheOptions instance with a null `ttl`
     * for keeping the value forever
     */
    const options = this.defaultCacheOptions.cloneWith({
      ttl: null,
      ...rawOptions,
    })

    return this.#getOrSet(key, factory, options)
  }

  /**
   * Check if a key exists in the cache
   */
  async has(key: string) {
    const inRemote = await this.#remoteDriver?.has(key)
    const inLocal = await this.#localDriver?.has(key)

    return !!(inRemote || inLocal)
  }

  /**
   * Check if key is missing in the cache
   */
  async missing(key: string) {
    return !(await this.has(key))
  }

  /**
   * Get the value of a key and delete it
   *
   * Returns the value if the key exists, undefined otherwise
   *
   * TODO
   */
  async pull<T = any>(key: string): Promise<T | undefined | null> {
    const result = await this.#localDriver.pull(key)
    const item = result === undefined ? undefined : await this.deserialize(result)

    if (result) {
      this.emit(new CacheHit(key, item.value, this.name))
      this.emit(new CacheDeleted(key, this.name))
    }

    return item
  }

  /**
   * Delete a key from the cache
   */
  async delete(key: string, rawOptions?: GetOrSetOptions): Promise<boolean> {
    const options = this.defaultCacheOptions.cloneWith(rawOptions)

    /**
     * Delete from local and remote cache if available
     */
    await this.#localCache?.delete(key)
    await this.#remoteCache?.delete(key, options)

    /**
     * Emit cache:deleted event
     */
    this.emit(new CacheDeleted(key, this.name))

    /**
     * Publish invalidation through the bus
     */
    await this.#bus?.publish({ type: CacheBusMessageType.Delete, keys: [key] })

    return true
  }

  /**
   * Delete multiple keys from the cache
   */
  async deleteMany(keys: string[], rawOptions?: GetOrSetOptions): Promise<boolean> {
    const options = this.defaultCacheOptions.cloneWith(rawOptions)

    /**
     * Delete from local and remote cache if available
     */
    await this.#localCache?.deleteMany(keys)
    await this.#remoteCache?.deleteMany(keys, options)

    /**
     * Emit cache:deleted events for each key
     */
    keys.forEach((key) => this.emit(new CacheDeleted(key, this.name)))

    /**
     * publis invalidation through the bus
     */
    await this.#bus?.publish({ type: CacheBusMessageType.Delete, keys })

    return true
  }

  /**
   * Remove all items from the cache
   */
  async clear() {
    await Promise.all([this.#localDriver?.clear(), this.#remoteDriver?.clear()])
    this.emit(new CacheCleared(this.name))
  }

  /**
   * Closes the connection to the cache
   */
  async disconnect() {
    await Promise.all([
      this.#localDriver?.disconnect(),
      this.#remoteDriver?.disconnect(),
      this.#bus?.disconnect(),
    ])
  }
}
