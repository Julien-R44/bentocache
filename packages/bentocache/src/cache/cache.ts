import { events } from '../events/index.js'
import { GetSetHandler } from './get_set_handler.js'
import { CacheBusMessageType } from '../types/main.js'
import type { CacheStack } from './stack/cache_stack.js'
import type { CacheProvider } from '../types/provider.js'
import { CacheStackWriter } from './stack/cache_stack_writer.js'
import type {
  GetOrSetOptions,
  Factory,
  GetOptions,
  DeleteOptions,
  SetOptions,
  HasOptions,
  ClearOptions,
  GetSetFactory,
  GetOrSetPojoOptions,
  GetPojoOptions,
  SetPojoOptions,
  HasPojoOptions,
  DeletePojoOptions,
  DeleteManyPojoOptions,
  GetOrSetForeverPojoOptions,
  GetOrSetForeverOptions,
} from '../types/main.js'

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

  get<T = any>(options: GetPojoOptions<T>): Promise<T>
  get<T = any>(key: string): Promise<T | null | undefined>
  get<T = any>(key: string, defaultValue: Factory<T>, options?: GetOptions): Promise<T>
  async get<T = any>(
    keyOrOptions: string | GetPojoOptions<T>,
    defaultValue?: Factory<T>,
    rawOptions?: GetOptions,
  ): Promise<T | undefined | null> {
    let key: string
    let providedOptions: GetOptions
    let defaultValueFn: Factory<T>

    if (typeof keyOrOptions === 'string') {
      key = keyOrOptions
      providedOptions = rawOptions ?? {}
      defaultValueFn = this.#resolveDefaultValue(defaultValue)
    } else {
      key = keyOrOptions.key
      providedOptions = keyOrOptions
      defaultValueFn = this.#resolveDefaultValue(keyOrOptions.defaultValue)
    }

    const options = this.#stack.defaultOptions.cloneWith(providedOptions)
    const localItem = this.#stack.l1?.get(key, options)

    if (localItem !== undefined && !localItem.isLogicallyExpired()) {
      this.#stack.emit(new events.CacheHit(key, localItem.getValue(), this.name))
      return localItem.getValue()
    }

    const remoteItem = await this.#stack.l2?.get(key, options)

    if (remoteItem !== undefined && !remoteItem.isLogicallyExpired()) {
      this.#stack.l1?.set(key, remoteItem.serialize(), options)
      this.#stack.emit(new events.CacheHit(key, remoteItem.getValue(), this.name))
      return remoteItem.getValue()
    }

    if (!options.isGracePeriodEnabled) {
      this.#stack.emit(new events.CacheMiss(key, this.name))
      return this.#resolveDefaultValue(defaultValueFn)
    }

    if (remoteItem) {
      this.#stack.l1?.set(key, remoteItem.serialize(), options)
      this.#stack.emit(new events.CacheHit(key, remoteItem.serialize(), this.name, true))
      return remoteItem.getValue()
    }

    if (localItem) {
      this.#stack.emit(new events.CacheHit(key, localItem.serialize(), this.name, true))
      return localItem.getValue()
    }

    this.#stack.emit(new events.CacheMiss(key, this.name))
    return this.#resolveDefaultValue(defaultValueFn)
  }

  /**
   * Set a value in the cache
   * Returns true if the value was set, false otherwise
   */
  async set(keyOrOptions: string | SetPojoOptions, value?: any, rawOptions?: SetOptions) {
    if (typeof keyOrOptions === 'string') {
      const options = this.#stack.defaultOptions.cloneWith(rawOptions)
      return this.#cacheWriter.set(keyOrOptions, value, options)
    }

    const options = this.#stack.defaultOptions.cloneWith(keyOrOptions)
    return this.#cacheWriter.set(keyOrOptions.key, keyOrOptions.value, options)
  }

  /**
   * Set a value in the cache forever
   * Returns true if the value was set, false otherwise
   */
  async setForever<T>(keyOrOptions: string | SetPojoOptions, value?: T, rawOptions?: SetOptions) {
    return this.set(keyOrOptions, value, { ttl: null, ...rawOptions })
  }

  /**
   * Retrieve an item from the cache if it exists, otherwise store the value
   * provided by the factory and return it
   */
  async getOrSet<T>(
    keyOrOptions: string | GetOrSetPojoOptions<T>,
    factory?: GetSetFactory<T>,
    options?: GetOrSetOptions,
  ): Promise<T> {
    if (typeof keyOrOptions === 'string') {
      const cacheOptions = this.#stack.defaultOptions.cloneWith(options)
      return this.#getSetHandler.handle(keyOrOptions, factory, cacheOptions)
    }

    const cacheOptions = this.#stack.defaultOptions.cloneWith(keyOrOptions)
    return this.#getSetHandler.handle(keyOrOptions.key, keyOrOptions.factory, cacheOptions)
  }

  /**
   * Retrieve an item from the cache if it exists, otherwise store the value
   * provided by the factory forever and return it
   */
  async getOrSetForever<T>(
    keyOrOptions: string | GetOrSetForeverPojoOptions<T>,
    factory?: GetSetFactory<T>,
    options?: GetOrSetForeverOptions,
  ): Promise<T> {
    if (typeof keyOrOptions === 'string') {
      const cacheOptions = this.#stack.defaultOptions.cloneWith({ ttl: null, ...options })
      return this.#getSetHandler.handle(keyOrOptions, factory, cacheOptions)
    }

    const cacheOptions = this.#stack.defaultOptions.cloneWith({ ttl: null, ...keyOrOptions })
    return this.#getSetHandler.handle(keyOrOptions.key, keyOrOptions.factory, cacheOptions)
  }

  /**
   * Check if a key exists in the cache
   */
  async has(keyOrOptions: string | HasPojoOptions, options?: HasOptions) {
    const key = typeof keyOrOptions === 'string' ? keyOrOptions : keyOrOptions.key
    const providedOptions = typeof keyOrOptions === 'string' ? options : keyOrOptions

    const cacheOptions = this.#stack.defaultOptions.cloneWith(providedOptions)

    const inRemote = await this.#stack.l2?.has(key, cacheOptions)
    const inLocal = this.#stack.l1?.has(key)

    return !!(inRemote || inLocal)
  }

  /**
   * Check if key is missing in the cache
   */
  async missing(keyOrOptions: string | HasPojoOptions, options?: HasOptions) {
    return !(await this.has(keyOrOptions, options))
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
  async delete(
    keyOrOptions: string | DeletePojoOptions,
    rawOptions?: DeleteOptions,
  ): Promise<boolean> {
    const isPojo = typeof keyOrOptions !== 'string'
    const key = isPojo ? keyOrOptions.key : keyOrOptions
    const options = this.#stack.defaultOptions.cloneWith(isPojo ? keyOrOptions : rawOptions)

    this.#stack.l1?.delete(key, options)
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
  async deleteMany(
    keysOrOptions: string[] | DeleteManyPojoOptions,
    rawOptions?: DeleteOptions,
  ): Promise<boolean> {
    const isPojo = !Array.isArray(keysOrOptions)
    const options = this.#stack.defaultOptions.cloneWith(isPojo ? keysOrOptions : rawOptions)
    const keys = isPojo ? keysOrOptions.keys : keysOrOptions

    this.#stack.l1?.deleteMany(keys, options)
    await this.#stack.l2?.deleteMany(keys, options)

    keys.forEach((key) => this.#stack.emit(new events.CacheDeleted(key, this.name)))

    await this.#stack.bus?.publish({ type: CacheBusMessageType.Delete, keys })

    return true
  }

  /**
   * Remove all items from the cache
   */
  async clear(options?: ClearOptions) {
    const cacheOptions = this.#stack.defaultOptions.cloneWith(options)

    await Promise.all([
      this.#stack.l1?.clear(),
      this.#stack.l2?.clear(cacheOptions),
      this.#stack.bus?.publish({ type: CacheBusMessageType.Clear, keys: [] }),
    ])

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
