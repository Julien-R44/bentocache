import { events } from '../events/index.js'
import { GetSetHandler } from './get_set_handler.js'
import { CacheBusMessageType } from '../types/main.js'
import type { CacheStack } from './stack/cache_stack.js'
import type { CacheProvider } from '../types/provider.js'
import { CacheStackWriter } from './stack/cache_stack_writer.js'
import type { GetOrSetOptions, RawCommonOptions, Factory } from '../types/main.js'

export class Cache implements CacheProvider {
  /**
   * The name of the cache
   */
  name: string

  #getSetHandler: GetSetHandler
  #cacheWriter: CacheStackWriter
  #stack: CacheStack

  constructor(name: string, stack: CacheStack) {
    this.name = name

    this.#stack = stack
    this.#cacheWriter = new CacheStackWriter(this.#stack)
    this.#getSetHandler = new GetSetHandler(this.#stack, this.#cacheWriter)
  }

  #resolveDefaultValue(defaultValue?: Factory) {
    return typeof defaultValue === 'function' ? defaultValue() : defaultValue ?? undefined
  }

  /**
   * Returns a new instance of the driver namespaced
   */
  namespace(namespace: string) {
    return new Cache(this.name, this.#stack.namespace(namespace))
  }

  get<T = any>(key: string): Promise<T | undefined | null>
  get<T = any>(key: string, defaultValue: Factory<T>): Promise<T>
  get<T = any>(key: string, defaultValue?: Factory<T>, options?: GetOrSetOptions): Promise<T>
  async get<T = any>(
    key: string,
    defaultValue?: Factory<T>,
    rawOptions?: GetOrSetOptions
  ): Promise<T | undefined | null> {
    const options = this.#stack.defaultOptions.cloneWith(rawOptions)
    const localItem = await this.#stack.l1?.get(key, options)

    if (localItem !== undefined && !localItem.isLogicallyExpired()) {
      this.#stack.emit(new events.CacheHit(key, localItem.getValue(), this.name))
      return localItem.getValue()
    }

    const remoteItem = await this.#stack.l2?.get(key, options)

    if (remoteItem !== undefined && !remoteItem.isLogicallyExpired()) {
      await this.#stack.l1?.set(key, remoteItem.serialize(), options)
      this.#stack.emit(new events.CacheHit(key, remoteItem.getValue(), this.name))
      return remoteItem.getValue()
    }

    if (!options.isGracePeriodEnabled) {
      this.#stack.emit(new events.CacheMiss(key, this.name))
      return this.#resolveDefaultValue(defaultValue)
    }

    if (remoteItem) {
      await this.#stack.l1?.set(key, remoteItem.serialize(), options)
      this.#stack.emit(new events.CacheHit(key, remoteItem.serialize(), this.name, true))
      return remoteItem.getValue()
    }

    if (localItem) {
      this.#stack.emit(new events.CacheHit(key, localItem.serialize(), this.name, true))
      return localItem.getValue()
    }
  }

  /**
   * Set a value in the cache
   * Returns true if the value was set, false otherwise
   */
  async set(key: string, value: any, rawOptions?: RawCommonOptions) {
    const options = this.#stack.defaultOptions.cloneWith(rawOptions)
    return this.#cacheWriter.set(key, value, options)
  }

  /**
   * Set a value in the cache forever
   * Returns true if the value was set, false otherwise
   */
  async setForever<T>(key: string, value: T, rawOptions?: RawCommonOptions) {
    const options = this.#stack.defaultOptions.cloneWith({ ttl: null, ...rawOptions })
    return this.#cacheWriter.set(key, value, options)
  }

  /**
   * Retrieve an item from the cache if it exists, otherwise store the value
   * provided by the factory and return it
   */
  async getOrSet<T>(key: string, factory: Factory<T>, options?: GetOrSetOptions): Promise<T> {
    const cacheOptions = this.#stack.defaultOptions.cloneWith(options)
    return this.#getSetHandler.handle(key, factory, cacheOptions)
  }

  /**
   * Retrieve an item from the cache if it exists, otherwise store the value
   * provided by the factory forever and return it
   */
  async getOrSetForever<T>(
    key: string,
    factory: Factory<T>,
    options?: GetOrSetOptions
  ): Promise<T> {
    const cacheOptions = this.#stack.defaultOptions.cloneWith({ ttl: null, ...options })
    return this.#getSetHandler.handle(key, factory, cacheOptions)
  }

  /**
   * Check if a key exists in the cache
   */
  async has(key: string) {
    const inRemote = await this.#stack.l2?.has(key)
    const inLocal = await this.#stack.l1?.has(key)

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
    const options = this.#stack.defaultOptions.cloneWith(rawOptions)

    await this.#stack.l1?.delete(key, options)
    await this.#stack.l2?.delete(key, options)

    this.#stack.emit(new events.CacheDeleted(key, this.name))

    await this.#stack.bus?.publish({ type: CacheBusMessageType.Delete, keys: [key] })

    return true
  }

  /**
   * Delete multiple keys from local and remote cache
   * Then emit cache:deleted events for each key
   * And finally publish invalidation through the bus
   */
  async deleteMany(keys: string[], rawOptions?: GetOrSetOptions): Promise<boolean> {
    const options = this.#stack.defaultOptions.cloneWith(rawOptions)

    await this.#stack.l1?.deleteMany(keys, options)
    await this.#stack.l2?.deleteMany(keys, options)

    keys.forEach((key) => this.#stack.emit(new events.CacheDeleted(key, this.name)))

    await this.#stack.bus?.publish({ type: CacheBusMessageType.Delete, keys })

    return true
  }

  /**
   * Remove all items from the cache
   */
  async clear() {
    await Promise.all([this.#stack.l1?.clear(), this.#stack.l2?.clear()])
    this.#stack.emit(new events.CacheCleared(this.name))
  }

  /**
   * Closes the connection to the cache
   */
  async disconnect() {
    await Promise.all([
      this.#stack.l1?.disconnect(),
      this.#stack.l2?.disconnect(),
      this.#stack.bus?.disconnect(),
    ])
  }
}
