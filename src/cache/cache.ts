/*
 * @adonisjs/cache
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import lodash from '@poppinss/utils/lodash'

import { Locks } from './locks.js'
import { Bus } from '../bus/bus.js'
import { resolveTtl } from '../helpers.js'
import { events } from '../events/index.js'
import { LocalCache } from './local_cache.js'
import { RemoteCache } from './remote_cache.js'
import type { CacheItem } from './cache_item.js'
import { CacheBusMessageType } from '../types/main.js'
import { JsonSerializer } from '../serializers/json.js'
import type { CacheProvider } from '../types/provider.js'
import { CacheItemOptions } from './cache_item_options.js'
import type { BentoCacheOptions } from '../bento_cache_options.js'
import type {
  CacheDriver,
  CachedValue,
  GetOrSetOptions,
  CacheEvent,
  CacheSerializer,
  RawCommonOptions,
  TTL,
  Factory,
  BusDriver,
  BusOptions,
} from '../types/main.js'

export class Cache implements CacheProvider {
  /**
   * Name of the cache
   */
  name: string

  /**
   * The local cache instance
   */
  #localCache?: LocalCache

  /**
   * The remote cache instance
   */
  #remoteCache?: RemoteCache

  /**
   * The bus instance
   */
  #bus?: Bus

  /**
   * The Bento cache options
   */
  #options: BentoCacheOptions

  /**
   * The default CacheItemOptions
   */
  #defaultCacheOptions: CacheItemOptions

  /**
   * The Cache serializer
   */
  #serializer: CacheSerializer = new JsonSerializer()

  /**
   * A map that will hold active locks for each key
   */
  #locks = new Locks()

  constructor(
    name: string,
    options: BentoCacheOptions,
    drivers: {
      localDriver?: CacheDriver
      remoteDriver?: CacheDriver
      busDriver?: BusDriver
      busOptions?: BusOptions
    },
    bus?: Bus
  ) {
    this.name = name
    this.#options = options
    this.#defaultCacheOptions = new CacheItemOptions(options)

    if (drivers.localDriver) {
      this.#localCache = new LocalCache(drivers.localDriver, this.#logger)
    }

    if (drivers.remoteDriver) {
      this.#remoteCache = new RemoteCache(drivers.remoteDriver, this.#logger)
    }

    this.#bus = this.#createBus(drivers.busDriver, bus, drivers.busOptions)
  }

  #createBus(busDriver?: BusDriver, bus?: Bus, busOptions?: BusOptions) {
    if (bus) {
      return bus
    }

    if (busDriver && this.#localCache) {
      const opts = lodash.merge({ retryQueue: { enabled: true, maxSize: undefined } }, busOptions)
      const newBus = new Bus(busDriver, this.#localCache, this.#logger, this.#options.emitter, opts)

      newBus.subscribe()
      return newBus
    }
  }

  get #logger() {
    return this.#options.logger
  }

  protected resolveGetSetOptions(
    ttlOrFactory: TTL | Factory,
    factoryOrOptions?: Factory | GetOrSetOptions,
    options?: GetOrSetOptions
  ) {
    let ttl: TTL | undefined
    let factory: Factory
    let resolvedOptions: GetOrSetOptions

    if (typeof ttlOrFactory === 'function') {
      factory = ttlOrFactory
      resolvedOptions = factoryOrOptions || options
    } else {
      ttl = resolveTtl(ttlOrFactory)!
      factory = factoryOrOptions
      resolvedOptions = options!
    }

    const cacheOptions = this.#defaultCacheOptions.cloneWith({
      ttl: ttl,
      timeouts: undefined,
      ...resolvedOptions,
    })

    return { ttl, factory, options: cacheOptions }
  }

  /**
   * Serialize a value
   */
  #serialize(value: any) {
    return this.#serializer.serialize(value)
  }

  /**
   * Emit a CacheEvent using the emitter
   */
  #emit(event: CacheEvent) {
    return this.#options.emitter?.emit(event.name, event.toJSON())
  }

  #resolveDefaultValue(defaultValue?: Factory) {
    return typeof defaultValue === 'function' ? defaultValue() : defaultValue ?? undefined
  }

  /**
   * Set a value in the cache
   */
  async #set(key: string, value: any, options: CacheItemOptions) {
    const item = this.#serializer.serialize({
      value: value,
      logicalExpiration: options.logicalTtlFromNow(),
      earlyExpiration: options.earlyExpireTtlFromNow(),
    })

    await this.#localCache?.set(key, item, options)
    await this.#remoteCache?.set(key, item, options)
    await this.#bus?.publish({ type: CacheBusMessageType.Set, keys: [key] })

    this.#emit(new events.CacheWritten(key, value, this.name))
    return true
  }

  /**
   * Returns a new instance of the driver namespaced
   */
  namespace(namespace: string) {
    return new Cache(
      this.name,
      this.#options,
      {
        localDriver: this.#localCache?.namespace(namespace),
        remoteDriver: this.#remoteCache?.namespace(namespace),
      },
      this.#bus
    )
  }

  get<T = any>(key: string): Promise<T | undefined | null>
  get<T = any>(key: string, defaultValue: Factory<T>): Promise<T>
  get<T = any>(key: string, defaultValue?: Factory<T>, options?: GetOrSetOptions): Promise<T>
  async get<T = any>(
    key: string,
    defaultValue?: Factory<T>,
    rawOptions?: GetOrSetOptions
  ): Promise<T | undefined | null> {
    const options = this.#defaultCacheOptions.cloneWith(rawOptions)
    const localItem = await this.#localCache?.get(key, options)

    /**
     * Item found in local cache and is not logically expired. So we can
     * return it right away
     */
    if (localItem !== undefined && !localItem.isLogicallyExpired()) {
      this.#emit(new events.CacheHit(key, localItem.getValue(), this.name))
      return localItem.getValue()
    }

    /**
     * Item wasn't found in the local cache. So let's try
     * with the remote cache
     */
    const remoteItem = await this.#remoteCache?.get(key, options)

    /**
     * Item found in remote cache and is not logically expired. So we can
     * save it to the local cache and return it right away
     */
    if (remoteItem !== undefined && !remoteItem.isLogicallyExpired()) {
      await this.#localCache?.set(key, remoteItem.serialize(), options)
      this.#emit(new events.CacheHit(key, remoteItem.getValue(), this.name))
      return remoteItem.getValue()
    }

    if (options.isGracePeriodEnabled) {
      if (remoteItem) {
        await this.#localCache?.set(key, remoteItem.serialize(), options)
        this.#emit(new events.CacheHit(key, remoteItem.serialize(), this.name))
        return remoteItem.getValue()
      }

      if (localItem) {
        this.#emit(new events.CacheHit(key, localItem.serialize(), this.name))
        return localItem.getValue()
      }
    }

    this.#emit(new events.CacheMiss(key, this.name))
    return this.#resolveDefaultValue(defaultValue)
  }

  /**
   * Set a value in the cache
   * Returns true if the value was set, false otherwise
   */
  async set(key: string, value: any, rawOptions?: RawCommonOptions) {
    const options = this.#defaultCacheOptions.cloneWith(rawOptions)
    return this.#set(key, value, options)
  }

  /**
   * Set a value in the cache forever
   * Returns true if the value was set, false otherwise
   */
  async setForever<T>(key: string, value: T, rawOptions?: RawCommonOptions) {
    const options = this.#defaultCacheOptions.cloneWith({ ttl: null, ...rawOptions })
    return this.#set(key, value, options)
  }

  /**
   * Refreshes the value of a cache
   */
  async #earlyExpirationRefresh(key: string, factory: Factory, options: CacheItemOptions) {
    this.#logger.debug({ key, name: this.name, opId: options.id }, 'try to early refresh')
    let lock = this.#locks.getOrCreateForKey(key)

    /**
     * If lock is already acquired, then just exit. We only want to run
     * the factory once, in background.
     */
    if (lock.isLocked()) {
      return
    }

    await lock
      .runExclusive(async () => {
        this.#logger.trace({ key, cache: this.name, opId: options.id }, 'acquired lock')
        await this.#set(key, await factory(), options)
      })
      .catch((error) => {
        const msg = 'factory error in early refresh'
        this.#logger.error({ key, cache: this.name, opId: options.id, error }, msg)

        throw error
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
      this.#emit(new events.CacheHit(key, localCacheItem.getValue(), this.name))
      this.#logger.trace({ key, cache: this.name, opId: options.id }, 'local cache hit')
      return localCacheItem.getValue()
    }

    /**
     * We didn't find the value in the local or remote cache
     * We need to run the factory and set the value in the different caches
     */
    const lock = this.#locks.getOrCreateForKey(key, options.lockTimeout)

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
          this.#emit(new events.CacheHit(key, localCacheItem.getValue(), this.name))
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
          this.#emit(new events.CacheHit(key, remoteCacheItem.getValue(), this.name))
          return remoteCacheItem.getValue()
        }

        /**
         * Execute the factory and prepare the cache item to store
         */
        const item = {
          value: await factory(),
          logicalExpiration: options.logicalTtlFromNow(),
          earlyExpiration: options.earlyExpireTtlFromNow(),
        }

        await this.#localCache?.set(key, this.#serialize(item), options)
        await this.#remoteCache?.set(key, this.#serialize(item), options)
        await this.#bus?.publish({ keys: [key], type: CacheBusMessageType.Set })

        /**
         * Emit cache:miss and cache:written events
         */
        this.#emit(new events.CacheMiss(key, this.name))
        this.#emit(new events.CacheWritten(key, item.value, this.name))

        /**
         * Return the value
         */
        this.#logger.trace({ key, cache: this.name, opId: options.id }, 'cache miss')
        return item.value
      })
      .catch(async (error) => {
        this.#logger.trace({ key, cache: this.name, opId: options.id }, 'factory error')

        /**
         * If the factory failed and grace period is enabled, we have to
         * return the old cached value if it exists.
         */
        const staleItem = localCacheItem ?? remoteCacheItem
        if (options.gracePeriod?.enabled && staleItem) {
          if (options.gracePeriod.fallbackDuration) {
            await this.#localCache?.set(
              key,
              staleItem.applyFallbackDuration(options.gracePeriod.fallbackDuration).serialize(),
              options
            )
          }

          this.#logger.trace({ key, cache: this.name, opId: options.id }, 'returns stale value')
          return staleItem.getValue()
        }

        throw error
      })
      .finally(() => {
        this.#locks.delete(key)
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
    const options = this.#defaultCacheOptions.cloneWith({
      ttl: null,
      ...rawOptions,
    })

    return this.#getOrSet(key, factory, options)
  }

  /**
   * Check if a key exists in the cache
   */
  async has(key: string) {
    const inRemote = await this.#remoteCache?.has(key)
    const inLocal = await this.#localCache?.has(key)

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
   * Returns the value if the key exists, undefined otherwise
   */
  async pull<T = any>(key: string): Promise<T | undefined | null> {
    const value = await this.get<T>(key)
    await this.delete(key)
    return value
  }

  /**
   * Delete a key from the cache, emit cache:deleted event and
   * publish invalidation through the bus
   */
  async delete(key: string, rawOptions?: GetOrSetOptions): Promise<boolean> {
    const options = this.#defaultCacheOptions.cloneWith(rawOptions)

    await this.#localCache?.delete(key)
    await this.#remoteCache?.delete(key, options)

    this.#emit(new events.CacheDeleted(key, this.name))

    await this.#bus?.publish({ type: CacheBusMessageType.Delete, keys: [key] })

    return true
  }

  /**
   * Delete multiple keys from local and remote cache
   * Then emit cache:deleted events for each key
   * And finally publish invalidation through the bus
   */
  async deleteMany(keys: string[], rawOptions?: GetOrSetOptions): Promise<boolean> {
    const options = this.#defaultCacheOptions.cloneWith(rawOptions)

    await this.#localCache?.deleteMany(keys)
    await this.#remoteCache?.deleteMany(keys, options)

    keys.forEach((key) => this.#emit(new events.CacheDeleted(key, this.name)))

    await this.#bus?.publish({ type: CacheBusMessageType.Delete, keys })

    return true
  }

  /**
   * Remove all items from the cache
   */
  async clear() {
    await Promise.all([this.#localCache?.clear(), this.#remoteCache?.clear()])
    this.#emit(new events.CacheCleared(this.name))
  }

  /**
   * Closes the connection to the cache
   */
  async disconnect() {
    await Promise.all([
      this.#localCache?.disconnect(),
      this.#remoteCache?.disconnect(),
      this.#bus?.disconnect(),
    ])
  }
}
