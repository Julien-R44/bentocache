/*
 * @quakjs/bentocache
 *
 * (c) Quak
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import type {
  CreateDriverResult,
  CacheEvents,
  Factory,
  GetOrSetOptions,
  RawCommonOptions,
  RawBentoCacheOptions,
} from './types/main.js'
import { Cache } from './cache/cache.js'
import { resolveTtl } from './helpers.js'
import type { CacheProvider } from './types/provider.js'
import { BentoCacheOptions } from './bento_cache_options.js'

export class BentoCache<KnownCaches extends Record<string, CreateDriverResult>>
  implements CacheProvider
{
  /**
   * Name of the default cache
   */
  #defaultCache: keyof KnownCaches

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

  constructor(config: RawBentoCacheOptions & { default: keyof KnownCaches; stores: KnownCaches }) {
    this.#stores = config.stores
    this.#defaultCache = config.default

    this.#options = new BentoCacheOptions(config)
    this.#options.logger.trace('bentocache initialized')
  }

  #createProvider(cacheName: string, registry: CreateDriverResult): CacheProvider {
    const localDriverOptions = {
      prefix: registry.local.options.prefix || this.#options.prefix,
      ttl: resolveTtl(registry.local.options.ttl, this.#options.ttl),
    }

    const remoteDriverOptions = {
      prefix: registry.remote?.options.prefix || this.#options.prefix,
      ttl: resolveTtl(registry.remote?.options.ttl, this.#options.ttl),
    }

    return new Cache(cacheName, this.#options, {
      localDriver: registry.local.factory(localDriverOptions),
      remoteDriver: registry.remote?.factory(remoteDriverOptions),
      busDriver: registry.bus?.factory(registry.bus.options),
      busOptions: registry.bus?.options,
    })
  }

  /**
   * Use a registered cache driver
   */
  use<CacheName extends keyof KnownCaches>(cache?: CacheName) {
    let cacheToUse: keyof KnownCaches | undefined = cache || this.#defaultCache
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
  get<T = any>(key: string): Promise<T | undefined | null>
  get<T = any>(key: string, defaultValue: Factory<T>): Promise<T>
  get<T = any>(key: string, defaultValue?: Factory<T>, options?: GetOrSetOptions): Promise<T>
  async get<T = any>(
    key: string,
    defaultValue?: Factory<T>,
    rawOptions?: GetOrSetOptions
  ): Promise<T> {
    return this.use().get<T>(key, defaultValue, rawOptions)
  }

  /**
   * Put a value in the cache
   * Returns true if the value was set, false otherwise
   */
  async set(key: string, value: any, options?: RawCommonOptions) {
    return this.use().set(key, value, options)
  }

  /**
   * Put a value in the cache forever
   * Returns true if the value was set, false otherwise
   */
  async setForever(key: string, value: any) {
    return this.use().setForever(key, value)
  }

  /**
   * Retrieve an item from the cache if it exists, otherwise store the value
   * provided by the factory and return it
   */
  async getOrSet<T>(key: string, factory: Factory<T>, options?: GetOrSetOptions): Promise<T> {
    return this.use().getOrSet(key, factory, options)
  }

  /**
   * Retrieve an item from the cache if it exists, otherwise store the value
   * provided by the factory forever and return it
   */
  getOrSetForever<T>(key: string, cb: Factory<T>, opts?: GetOrSetOptions): Promise<T> {
    return this.use().getOrSetForever(key, cb, opts)
  }

  /**
   * Check if a key exists in the cache
   */
  async has(key: string) {
    return this.use().has(key)
  }

  /**
   * Check if key is missing in the cache
   */
  async missing(key: string) {
    return this.use().missing(key)
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
  async delete(key: string) {
    return this.use().delete(key)
  }

  /**
   * Delete multiple keys from the cache
   */
  async deleteMany(keys: string[]): Promise<boolean> {
    return this.use().deleteMany(keys)
  }

  /**
   * Remove all items from the cache
   */
  async clear() {
    return this.use().clear()
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
