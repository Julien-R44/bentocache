/*
 * @adonisjs/cache
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import Emittery from 'emittery'

import { Cache } from './providers/cache.js'
import { resolveTtl } from './helpers.js'
import type {
  CreateDriverResult,
  CacheEvents,
  Emitter,
  KeyValueObject,
  TTL,
  GracefulRetainOptions,
} from './types/main.js'

export class CacheManager<KnownCaches extends Record<string, CreateDriverResult>> {
  #config: {
    default?: keyof KnownCaches
    stores: KnownCaches
  }

  /**
   * Reference to the event emitter
   */
  #emitter: Emitter

  /**
   * Cache of already instantiated drivers
   */
  #driversCache: Map<keyof KnownCaches, Cache> = new Map()

  /**
   * Default TTL for all the drivers when not defined explicitly
   *
   * @default 30s
   */
  #ttl: number

  #prefix?: string

  #gracefulRetain: GracefulRetainOptions

  constructor(
    config: {
      default?: keyof KnownCaches
      stores: KnownCaches
      ttl?: TTL
      prefix?: string
      gracefulRetain?: GracefulRetainOptions
    },
    emitter?: Emitter
  ) {
    this.#config = config
    this.#emitter = emitter || new Emittery()
    this.#ttl = resolveTtl(config.ttl, 30_000)
    this.#prefix = config.prefix

    this.#gracefulRetain = config.gracefulRetain || {
      enabled: false,
      duration: '6h',
      delay: '30s',
    }
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

    const { driver, options } = this.#config.stores[cacheToUse]

    const driverOptions = {
      prefix: options.prefix || this.#prefix,
      ttl: resolveTtl(options.ttl, this.#ttl),
      gracefulRetain: this.#gracefulRetain,
    }

    const cacheInstance = new Cache(cacheToUse as string, driver(driverOptions), {
      emitter: this.#emitter,
      ttl: driverOptions.ttl,
      gracefulRetain: this.#gracefulRetain,
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
    await Promise.all(Object.keys(this.#config.stores).map((cache) => this.use(cache).disconnect()))
  }
}
