import { is } from '@julr/utils/is'

import type { CacheStack } from './cache_stack.js'
import { cacheEvents } from '../events/cache_events.js'
import { cacheOperation } from '../tracing_channels.js'
import type { CacheProvider } from '../types/provider.js'
import { GetSetHandler } from './get_set/get_set_handler.js'
import type { BentoCacheOptions } from '../bento_cache_options.js'
import type { CacheOperationMessage } from '../types/tracing_channels.js'
import {
  type Factory,
  type ClearOptions,
  type GetOrSetOptions,
  type GetOptions,
  type SetOptions,
  type HasOptions,
  type DeleteOptions,
  type DeleteManyOptions,
  type GetOrSetForeverOptions,
  type ExpireOptions,
  type DeleteByTagOptions,
  CacheBusMessageType,
  type ExpireByTagOptions,
} from '../types/main.js'

export class Cache implements CacheProvider {
  /**
   * The name of the cache
   */
  name: string

  #getSetHandler: GetSetHandler
  #stack: CacheStack
  #options: BentoCacheOptions

  constructor(name: string, stack: CacheStack) {
    this.name = name

    this.#stack = stack
    this.#options = stack.options
    this.#getSetHandler = new GetSetHandler(this.#stack)
    this.#stack.setTagSystemGetSetHandler(this.#getSetHandler)
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
  async get<T = any>(rawOptions: GetOptions<T>): Promise<T | undefined | null> {
    const key = rawOptions.key
    const defaultValueFn = this.#resolveDefaultValue(rawOptions.defaultValue)

    const options = this.#stack.defaultOptions.cloneWith(rawOptions)
    this.#options.logger.logMethod({ method: 'get', key, options, cacheName: this.name })

    const message: CacheOperationMessage = {
      operation: 'get',
      key: this.#stack.getFullKey(key),
      store: this.name,
    }

    return cacheOperation.tracePromise(async () => {
      const localItem = this.#stack.l1?.get(key, options)
      const isLocalItemValid = await this.#stack.isEntryValid(localItem)
      if (isLocalItemValid) {
        this.#stack.emit(cacheEvents.hit(key, localItem!.entry.getValue(), this.name))
        this.#options.logger.logL1Hit({ cacheName: this.name, key, options })
        message.hit = true
        message.tier = 'l1'
        message.graced = false
        return localItem!.entry.getValue()
      }

      const remoteItem = await this.#stack.l2?.get(key, options)
      const isRemoteItemValid = await this.#stack.isEntryValid(remoteItem)

      if (isRemoteItemValid) {
        this.#stack.l1?.set(key, remoteItem!.entry.serialize(), options)
        this.#stack.emit(cacheEvents.hit(key, remoteItem!.entry.getValue(), this.name))
        this.#options.logger.logL2Hit({ cacheName: this.name, key, options })
        message.hit = true
        message.tier = 'l2'
        message.graced = false
        return remoteItem!.entry.getValue()
      }

      if (remoteItem && options.isGraceEnabled()) {
        this.#stack.l1?.set(key, remoteItem.entry.serialize(), options)
        this.#stack.emit(cacheEvents.hit(key, remoteItem.entry.serialize(), this.name, 'l2', true))
        this.#options.logger.logL2Hit({ cacheName: this.name, key, options, graced: true })
        message.hit = true
        message.tier = 'l2'
        message.graced = true
        return remoteItem.entry.getValue()
      }

      if (localItem && options.isGraceEnabled()) {
        this.#stack.emit(cacheEvents.hit(key, localItem.entry.serialize(), this.name, 'l2', true))
        this.#options.logger.logL1Hit({ cacheName: this.name, key, options, graced: true })
        message.hit = true
        message.tier = 'l1'
        message.graced = true
        return localItem.entry.getValue()
      }

      this.#stack.emit(cacheEvents.miss(key, this.name))
      this.#options.logger.debug({ key, cacheName: this.name }, 'cache miss. using default value')
      message.hit = false
      return this.#resolveDefaultValue(defaultValueFn)
    }, message)
  }

  /**
   * Set a value in the cache
   * Returns true if the value was set, false otherwise
   */
  set(rawOptions: SetOptions) {
    const options = this.#stack.defaultOptions.cloneWith(rawOptions)
    this.#options.logger.logMethod({
      method: 'set',
      options,
      key: rawOptions.key,
      cacheName: this.name,
    })

    return this.#stack.set(rawOptions.key, rawOptions.value, options)
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
  getOrSet<T>(rawOptions: GetOrSetOptions<T>): Promise<T> {
    const options = this.#stack.defaultOptions.cloneWith(rawOptions)
    this.#options.logger.logMethod({
      method: 'getOrSet',
      key: rawOptions.key,
      cacheName: this.name,
      options,
    })

    return this.#getSetHandler.handle(rawOptions.key, rawOptions.factory, options)
  }

  /**
   * Retrieve an item from the cache if it exists, otherwise store the value
   * provided by the factory forever and return it
   */
  getOrSetForever<T>(rawOptions: GetOrSetForeverOptions<T>): Promise<T> {
    const options = this.#stack.defaultOptions.cloneWith({ ttl: null, ...rawOptions })
    return this.#getSetHandler.handle(rawOptions.key, rawOptions.factory, options)
  }

  /**
   * Check if a key exists in the cache
   */
  async has(options: HasOptions) {
    const key = options.key
    const entryOptions = this.#stack.defaultOptions.cloneWith(options)
    this.#options.logger.logMethod({
      method: 'has',
      key,
      cacheName: this.name,
      options: entryOptions,
    })

    const localEntry = this.#stack.l1?.get(key, entryOptions)
    const isLocalEntryValid = await this.#stack.isEntryValid(localEntry)
    if (isLocalEntryValid) return true

    const inRemote = await this.#stack.l2?.get(key, entryOptions)
    const isRemoteEntryValid = await this.#stack.isEntryValid(inRemote)
    if (isRemoteEntryValid) return true

    return false
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
  async delete(rawOptions: DeleteOptions): Promise<boolean> {
    const key = rawOptions.key
    const options = this.#stack.defaultOptions.cloneWith(rawOptions)
    this.#options.logger.logMethod({ method: 'delete', key, cacheName: this.name, options })

    const message: CacheOperationMessage = {
      operation: 'delete',
      key: this.#stack.getFullKey(key),
      store: this.name,
    }

    return cacheOperation.tracePromise(async () => {
      this.#stack.l1?.delete(key, options)
      await this.#stack.l2?.delete(key, options)

      this.#stack.emit(cacheEvents.deleted(key, this.name))
      await this.#stack.publish({ type: CacheBusMessageType.Delete, keys: [key] })

      return true
    }, message)
  }

  /**
   * Invalidate all keys with the given tags
   */
  async expireByTag(rawOptions: ExpireByTagOptions): Promise<boolean> {
    const tags = rawOptions.tags
    const options = this.#stack.defaultOptions.cloneWith(rawOptions)

    this.#options.logger.logMethod({ method: 'expireByTag', cacheName: this.name, tags, options })

    return await this.#stack.createTagInvalidations(tags, options)
  }

  /**
   * Delete all keys with specific tags (lazy deletion)
   */
  async deleteByTag(rawOptions: DeleteByTagOptions): Promise<boolean> {
    const tags = rawOptions.tags
    const options = this.#stack.defaultOptions.cloneWith(rawOptions)

    this.#options.logger.logMethod({ method: 'deleteByTag', cacheName: this.name, tags, options })

    const result = await this.#stack.createTagDeletionTimestamps(tags, options)
    if (result) {
      // Emit a 'deleted' event, reflecting the intent even if deletion is lazy
      this.#stack.emit(cacheEvents.deleted('tags:' + tags.join(','), this.name))
    }
    return result
  }

  /**
   * Delete multiple keys from local and remote cache
   * Then emit cache:deleted events for each key
   * And finally publish invalidation through the bus
   */
  async deleteMany(rawOptions: DeleteManyOptions): Promise<boolean> {
    const keys = rawOptions.keys
    const options = this.#stack.defaultOptions.cloneWith(rawOptions)
    this.#options.logger.logMethod({
      method: 'deleteMany',
      key: keys,
      cacheName: this.name,
      options,
    })

    const message: CacheOperationMessage = {
      operation: 'deleteMany',
      keys: this.#stack.getFullKeys(keys),
      store: this.name,
    }

    return cacheOperation.tracePromise(async () => {
      this.#stack.l1?.deleteMany(keys, options)
      await this.#stack.l2?.deleteMany(keys, options)

      for (const key of keys) this.#stack.emit(cacheEvents.deleted(key, this.name))
      await this.#stack.publish({ type: CacheBusMessageType.Delete, keys })

      return true
    }, message)
  }

  /**
   * Expire a key from the cache.
   * Entry will not be fully deleted but expired and
   * retained for the grace period if enabled.
   */
  expire(rawOptions: ExpireOptions) {
    const key = rawOptions.key
    const options = this.#stack.defaultOptions.cloneWith(rawOptions)
    this.#options.logger.logMethod({ method: 'expire', cacheName: this.name, key, options })

    return this.#stack.expire(key, options)
  }

  /**
   * Remove all items from the cache
   */
  async clear(rawOptions?: ClearOptions) {
    const options = this.#stack.defaultOptions.cloneWith(rawOptions)
    this.#options.logger.logMethod({ method: 'clear', cacheName: this.name, options })

    const message: CacheOperationMessage = {
      operation: 'clear',
      store: this.name,
    }

    return cacheOperation.tracePromise(async () => {
      await Promise.all([
        this.#stack.l1?.clear(),
        this.#stack.l2?.clear(options),
        this.#stack.publish({ type: CacheBusMessageType.Clear, keys: [] }),
      ])

      this.#stack.emit(cacheEvents.cleared(this.name))
    }, message)
  }

  /**
   * Manually prune expired cache entries
   *
   * For drivers with native TTL support, this is typically a noop
   * For drivers without native TTL (PostgreSQL, File), this will remove expired entries
   */
  prune(): Promise<void> {
    return this.#stack.l2?.prune() ?? Promise.resolve()
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
