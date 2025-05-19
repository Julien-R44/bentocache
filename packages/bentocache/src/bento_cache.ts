import { Cache } from './cache/cache.js'
import type { BentoStore } from './bento_store.js'
import { CacheStack } from './cache/cache_stack.js'
import type { CacheProvider } from './types/provider.js'
import { BentoCacheOptions } from './bento_cache_options.js'
import type {
  CacheEvents,
  RawBentoCacheOptions,
  BentoCachePlugin,
  ClearOptions,
  GetOrSetForeverOptions,
  GetOrSetOptions,
  GetOptions,
  SetOptions,
  HasOptions,
  DeleteOptions,
  DeleteManyOptions,
  ExpireOptions,
  DeleteByTagOptions,
} from './types/main.js'

export class BentoCache<KnownCaches extends Record<string, BentoStore>> implements CacheProvider {
  /**
   * Name of the default cache
   */
  #defaultStoreName: keyof KnownCaches

  /**
   * List of registered caches
   */
  #stores: KnownCaches

  /**
   * Cache of already instantiated drivers
   */
  #driversCache: Map<keyof KnownCaches, CacheProvider> = new Map()

  /**
   * Bento Cache options instance
   */
  #options: BentoCacheOptions

  constructor(
    config: RawBentoCacheOptions & {
      default: keyof KnownCaches
      stores: KnownCaches
      plugins?: BentoCachePlugin[]
    },
  ) {
    this.#stores = config.stores
    this.#defaultStoreName = config.default

    this.#options = new BentoCacheOptions(config)
    this.#options.logger.trace('bentocache initialized')

    /**
     * Register plugins
     */
    if (config.plugins) config.plugins.forEach((plugin) => plugin.register(this))
  }

  #createProvider(cacheName: string, store: BentoStore): CacheProvider {
    const entry = store.entry
    const driverItemOptions = this.#options
      .cloneWith(entry.options)
      .serializeL1Cache(entry.l1?.options.serialize ?? true)

    const cacheStack = new CacheStack(cacheName, driverItemOptions, {
      l1Driver: entry.l1?.factory({
        prefix: driverItemOptions.prefix,
        logger: driverItemOptions.logger,
        ...entry.l1.options,
      }),
      l2Driver: entry.l2?.factory({
        prefix: driverItemOptions.prefix,
        logger: driverItemOptions.logger,
        ...entry.l2.options,
      }),
      busDriver: entry.bus?.factory(entry.bus?.options),
      busOptions: entry.bus?.options,
    })

    return new Cache(cacheName, cacheStack)
  }

  get defaultStoreName() {
    return this.#defaultStoreName as string
  }

  /**
   * Use a registered cache driver
   */
  use<CacheName extends keyof KnownCaches>(cache?: CacheName) {
    const cacheToUse: keyof KnownCaches | undefined = cache || this.#defaultStoreName
    if (!cacheToUse) throw new Error('No cache driver selected')

    /**
     * Check if the cache driver was already instantiated
     */
    if (this.#driversCache.has(cacheToUse)) {
      return this.#driversCache.get(cacheToUse)!
    }

    /**
     * Otherwise create a new instance and cache it
     */
    const provider = this.#createProvider(cacheToUse as string, this.#stores[cacheToUse])
    this.#driversCache.set(cacheToUse, provider)

    return provider
  }

  /**
   * Subscribe to a given cache event
   */
  on<Event extends keyof CacheEvents>(event: Event, callback: (arg: CacheEvents[Event]) => void) {
    this.#options.emitter.on(event, callback)
    return this
  }

  /**
   * Subscribe to a given cache event only once
   */
  once<Event extends keyof CacheEvents>(event: Event, callback: (arg: CacheEvents[Event]) => void) {
    this.#options.emitter.once(event, callback)
    return this
  }

  /**
   * Unsubscribe the callback from the given event
   */
  off<Event extends keyof CacheEvents>(event: Event, callback: (arg: CacheEvents[Event]) => void) {
    this.#options.emitter.off(event, callback)
    return this
  }

  /**
   * Returns a new instance of the driver namespaced
   */
  namespace(namespace: string) {
    return this.use().namespace(namespace)
  }

  /**
   * Get a value from the cache
   */
  async get<T = any>(options: GetOptions<T>): Promise<T> {
    return this.use().get<T>(options)
  }

  /**
   * Put a value in the cache
   * Returns true if the value was set, false otherwise
   */
  async set(options: SetOptions) {
    return this.use().set(options)
  }

  /**
   * Put a value in the cache forever
   * Returns true if the value was set, false otherwise
   */
  async setForever(options: SetOptions) {
    return this.use().setForever(options)
  }

  /**
   * Retrieve an item from the cache if it exists, otherwise store the value
   * provided by the factory and return it
   */
  async getOrSet<T>(options: GetOrSetOptions<T>): Promise<T> {
    return this.use().getOrSet(options)
  }

  /**
   * Retrieve an item from the cache if it exists, otherwise store the value
   * provided by the factory forever and return it
   */
  getOrSetForever<T>(options: GetOrSetForeverOptions<T>): Promise<T> {
    return this.use().getOrSetForever(options)
  }

  /**
   * Check if a key exists in the cache
   */
  async has(options: HasOptions) {
    return this.use().has(options)
  }

  /**
   * Check if key is missing in the cache
   */
  async missing(options: HasOptions) {
    return this.use().missing(options)
  }

  /**
   * Get the value of a key and delete it
   *
   * Returns the value if the key exists, undefined otherwise
   */
  async pull<T = any>(key: string) {
    return this.use().pull<T>(key)
  }

  /**
   * Delete a key from the cache
   * Returns true if the key was deleted, false otherwise
   */
  async delete(keyOrOptions: DeleteOptions) {
    return this.use().delete(keyOrOptions)
  }

  /**
   * Delete multiple keys from the cache
   */
  async deleteMany(options: DeleteManyOptions): Promise<boolean> {
    return this.use().deleteMany(options)
  }

  /**
   * Delete all keys with a specific tag
   */
  async deleteByTag(options: DeleteByTagOptions): Promise<boolean> {
    return this.use().deleteByTag(options)
  }

  /**
   * Expire a key from the cache.
   * Entry will not be fully deleted but expired and
   * retained for the grace period if enabled.
   */
  async expire(options: ExpireOptions) {
    return this.use().expire(options)
  }

  /**
   * Remove all items from the cache
   */
  async clear(options?: ClearOptions) {
    return this.use().clear(options)
  }

  /**
   * Remove all items from all caches
   */
  async clearAll(options?: ClearOptions) {
    await Promise.all(Object.keys(this.#stores).map((cache) => this.use(cache).clear(options)))
  }

  /**
   * Closes the connection to the cache
   */
  async disconnect() {
    return this.use().disconnect()
  }

  /**
   * Disconnect all cache connections created by the manager
   */
  async disconnectAll(): Promise<void> {
    await Promise.all(Object.keys(this.#stores).map((cache) => this.use(cache).disconnect()))
  }
}
