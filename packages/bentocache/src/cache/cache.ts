import { is } from '@julr/utils/is'

import type { CacheStack } from './cache_stack.js'
import { CacheBusMessageType } from '../types/main.js'
import { cacheEvents } from '../events/cache_events.js'
import type { CacheProvider } from '../types/provider.js'
import { GetSetHandler } from './get_set/get_set_handler.js'
import type {
  Factory,
  ClearOptions,
  GetOrSetOptions,
  GetOptions,
  SetOptions,
  HasOptions,
  DeleteOptions,
  DeleteManyOptions,
  GetOrSetForeverOptions,
} from '../types/main.js'

export class Cache implements CacheProvider {
  /**
   * The name of the cache
   */
  name: string

  #getSetHandler: GetSetHandler
  #stack: CacheStack

  constructor(name: string, stack: CacheStack) {
    this.name = name

    this.#stack = stack
    this.#getSetHandler = new GetSetHandler(this.#stack)
  }

  #resolveDefaultValue(defaultValue?: Factory) {
    return is.function(defaultValue) ? defaultValue() : (defaultValue ?? undefined)
  }

  /**
   * Returns a new instance of the driver namespaced
   */
  namespace(namespace: string) {
    return new Cache(this.name, this.#stack.namespace(namespace))
  }

  get<T = any>(options: GetOptions<T>): Promise<T>
  async get<T = any>(keyOrOptions: GetOptions<T>): Promise<T | undefined | null> {
    const key = keyOrOptions.key
    const providedOptions = keyOrOptions
    const defaultValueFn = this.#resolveDefaultValue(keyOrOptions.defaultValue)

    const options = this.#stack.defaultOptions.cloneWith(providedOptions)
    const localItem = this.#stack.l1?.get(key, options)

    if (localItem !== undefined && !localItem.isLogicallyExpired()) {
      this.#stack.emit(cacheEvents.hit(key, localItem.getValue(), this.name))
      return localItem.getValue()
    }

    const remoteItem = await this.#stack.l2?.get(key, options)

    if (remoteItem !== undefined && !remoteItem.isLogicallyExpired()) {
      this.#stack.l1?.set(key, remoteItem.serialize(), options)
      this.#stack.emit(cacheEvents.hit(key, remoteItem.getValue(), this.name))
      return remoteItem.getValue()
    }

    if (!options.isGraceEnabled()) {
      this.#stack.emit(cacheEvents.miss(key, this.name))
      return this.#resolveDefaultValue(defaultValueFn)
    }

    if (remoteItem) {
      this.#stack.l1?.set(key, remoteItem.serialize(), options)
      this.#stack.emit(cacheEvents.hit(key, remoteItem.serialize(), this.name, true))
      return remoteItem.getValue()
    }

    if (localItem) {
      this.#stack.emit(cacheEvents.hit(key, localItem.serialize(), this.name, true))
      return localItem.getValue()
    }

    this.#stack.emit(cacheEvents.miss(key, this.name))
    return this.#resolveDefaultValue(defaultValueFn)
  }

  /**
   * Set a value in the cache
   * Returns true if the value was set, false otherwise
   */
  set(options: SetOptions) {
    const cacheOptions = this.#stack.defaultOptions.cloneWith(options)
    return this.#stack.set(options.key, options.value, cacheOptions)
  }

  /**
   * Set a value in the cache forever
   * Returns true if the value was set, false otherwise
   */
  setForever(options: SetOptions) {
    return this.set({ ttl: null, ...options })
  }

  /**
   * Retrieve an item from the cache if it exists, otherwise store the value
   * provided by the factory and return it
   */
  getOrSet<T>(options: GetOrSetOptions<T>): Promise<T> {
    const cacheOptions = this.#stack.defaultOptions.cloneWith(options)
    return this.#getSetHandler.handle(options.key, options.factory, cacheOptions)
  }

  /**
   * Retrieve an item from the cache if it exists, otherwise store the value
   * provided by the factory forever and return it
   */
  getOrSetForever<T>(options: GetOrSetForeverOptions<T>): Promise<T> {
    const cacheOptions = this.#stack.defaultOptions.cloneWith({ ttl: null, ...options })
    return this.#getSetHandler.handle(options.key, options.factory, cacheOptions)
  }

  /**
   * Check if a key exists in the cache
   */
  async has(options: HasOptions) {
    const key = options.key
    const cacheOptions = this.#stack.defaultOptions.cloneWith(options)

    const inRemote = await this.#stack.l2?.has(key, cacheOptions)
    const inLocal = this.#stack.l1?.has(key)

    return !!(inRemote || inLocal)
  }

  /**
   * Check if key is missing in the cache
   */
  async missing(options: HasOptions) {
    return !(await this.has(options))
  }

  /**
   * Get the value of a key and delete it
   * Returns the value if the key exists, undefined otherwise
   */
  async pull<T = any>(key: string): Promise<T | undefined | null> {
    const value = await this.get<T>({ key })
    await this.delete({ key })
    return value
  }

  /**
   * Delete a key from the cache, emit cache:deleted event and
   * publish invalidation through the bus
   */
  async delete(options: DeleteOptions): Promise<boolean> {
    const key = options.key
    const cacheOptions = this.#stack.defaultOptions.cloneWith(options)

    this.#stack.l1?.delete(key, cacheOptions)
    await this.#stack.l2?.delete(key, cacheOptions)

    this.#stack.emit(cacheEvents.deleted(key, this.name))
    await this.#stack.publish({ type: CacheBusMessageType.Delete, keys: [key] })

    return true
  }

  /**
   * Delete multiple keys from local and remote cache
   * Then emit cache:deleted events for each key
   * And finally publish invalidation through the bus
   */
  async deleteMany(options: DeleteManyOptions): Promise<boolean> {
    const keys = options.keys
    const cacheOptions = this.#stack.defaultOptions.cloneWith(options)

    this.#stack.l1?.deleteMany(keys, cacheOptions)
    await this.#stack.l2?.deleteMany(keys, cacheOptions)

    keys.forEach((key) => this.#stack.emit(cacheEvents.deleted(key, this.name)))
    await this.#stack.publish({ type: CacheBusMessageType.Delete, keys })

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
      this.#stack.publish({ type: CacheBusMessageType.Clear, keys: [] }),
    ])

    this.#stack.emit(cacheEvents.cleared(this.name))
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
