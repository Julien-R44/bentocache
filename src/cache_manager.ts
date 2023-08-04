/*
 * @adonisjs/cache
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { Cache } from './cache.js'
import Emittery from 'emittery'

export class CacheManager<KnownCaches extends Record<string, CacheDriverFactory>> {
  #config: {
    default?: keyof KnownCaches
    list: KnownCaches
  }

  /**
   * Reference to the event emitter
   */
  #emitter: Emitter

  /**
   * Cache of already instantiated drivers
   */
  #driversCache: Map<keyof KnownCaches, Cache> = new Map()

  constructor(config: { default?: keyof KnownCaches; list: KnownCaches }, emitter?: Emitter) {
    this.#config = config
    this.#emitter = emitter || new Emittery()
    this.#fakedCacheManager = new FakeCacheManager<KnownCaches>(this.#emitter)
  }

  /**
   * Use a registered cache driver
   */
  use<CacheName extends keyof KnownCaches>(cache?: CacheName): Cache {
    let cacheToUse: keyof KnownCaches | undefined = cache || this.#config.default
    if (!cacheToUse) {
      throw new Error('No cache driver selected')
    }

    if (this.#driversCache.has(cacheToUse)) {
      return this.#driversCache.get(cacheToUse)!
    }

    const driverFactory = this.#config.list[cacheToUse]

    const cacheInstance = new Cache(cacheToUse as string, driverFactory({}), {
      emitter: this.#emitter,
    })
    this.#driversCache.set(cacheToUse, cacheInstance)
    return cacheInstance
  }
  /**
   * Subscribe to a given cache event
   */
  on<Event extends keyof CacheEvents>(event: Event, callback: (arg: CacheEvents[Event]) => void) {
    this.#emitter.on(event, callback)
    return this
  }

  /**
   * Subscribe to a given cache event only once
   */
  once<Event extends keyof CacheEvents>(event: Event, callback: (arg: CacheEvents[Event]) => void) {
    this.#emitter.once(event, callback)
    return this
  }

  /**
   * Unsubscribe the callback from the given event
   */
  off<Event extends keyof CacheEvents>(event: Event, callback: (arg: CacheEvents[Event]) => void) {
    this.#emitter.off(event, callback)
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
  async get<T>(key: string): Promise<T | null> {
    return this.use().get(key) as T
  }

  /**
   * Get many values from the cache
   * Will return an array of objects with `key` and `value` properties
   * If a value is not found, `value` will be undefined
   */
  async getMany(keys: string[]) {
    return this.use().getMany(keys)
  }

  /**
   * Put a value in the cache
   * Returns true if the value was set, false otherwise
   */
  async set(key: string, value: any, ttl?: number) {
    return this.use().set(key, value, ttl)
  }

  /**
   * Put a value in the cache forever
   * Returns true if the value was set, false otherwise
   */
  async setForever(key: string, value: any) {
    return this.use().setForever(key, value)
  }

  /**
   * Set many values in the cache
   */
  async setMany(values: KeyValueObject[]) {
    return this.use().setMany(values)
  }

  /**
   * Retrieve an item from the cache if it exists, otherwise store the value
   * provided by the callback and return it
   */
  async getOrSet() {
    // TODO
  }

  /**
   * Retrieve an item from the cache if it exists, otherwise store the value
   * provided by the callback forever and return it
   */
  async getOrSetForever() {
    // TODO
  }

  /**
   * Add the given amount to the value of a key.
   * Creates the key if it doesn't exist
   *
   * Returns the new value
   */
  async add(key: string, amount: number) {
    return this.use().add(key, amount)
  }

  /**
   * Increment a value by the given amount.
   * Creates the key if it doesn't exist
   */
  async increment(key: string, amount = 1) {
    return this.use().increment(key, amount)
  }

  /**
   * Decrement a value by the given amount.
   * Creates the key if it doesn't exist
   */
  async decrement(key: string, amount = -1) {
    return this.add(key, amount ?? -1)
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
  async pull(key: string) {
    return this.use().pull(key)
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
    await Promise.all(Object.keys(this.#config.list).map((cache) => this.use(cache).disconnect()))
  }
}
