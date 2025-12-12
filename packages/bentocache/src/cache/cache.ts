import { is } from '@julr/utils/is'

import type { CacheStack } from './cache_stack.js'
import { CacheBusMessageType } from '../types/main.js'
import { cacheEvents } from '../events/cache_events.js'
import type { CacheProvider } from '../types/provider.js'
import { GetSetHandler } from './get_set/get_set_handler.js'
import type { BentoCacheOptions } from '../bento_cache_options.js'
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
  ExpireOptions,
  DeleteByTagOptions,
  GetManyOptions,
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

    const localItem = this.#stack.l1?.get(key, options)
    const isLocalItemValid = await this.#stack.isEntryValid(localItem)
    if (isLocalItemValid) {
      this.#stack.emit(cacheEvents.hit(key, localItem!.entry.getValue(), this.name))
      this.#options.logger.logL1Hit({ cacheName: this.name, key, options })
      return localItem!.entry.getValue()
    }

    const remoteItem = await this.#stack.l2?.get(key, options)
    const isRemoteItemValid = await this.#stack.isEntryValid(remoteItem)

    if (isRemoteItemValid) {
      this.#stack.l1?.set(key, remoteItem!.entry.serialize(), options)
      this.#stack.emit(cacheEvents.hit(key, remoteItem!.entry.getValue(), this.name))
      this.#options.logger.logL2Hit({ cacheName: this.name, key, options })
      return remoteItem!.entry.getValue()
    }

    if (remoteItem && options.isGraceEnabled()) {
      this.#stack.l1?.set(key, remoteItem.entry.serialize(), options)
      this.#stack.emit(cacheEvents.hit(key, remoteItem.entry.serialize(), this.name, 'l2', true))
      this.#options.logger.logL2Hit({ cacheName: this.name, key, options, graced: true })
      return remoteItem.entry.getValue()
    }

    if (localItem && options.isGraceEnabled()) {
      this.#stack.emit(cacheEvents.hit(key, localItem.entry.serialize(), this.name, 'l2', true))
      this.#options.logger.logL1Hit({ cacheName: this.name, key, options, graced: true })
      return localItem.entry.getValue()
    }

    this.#stack.emit(cacheEvents.miss(key, this.name))
    this.#options.logger.debug({ key, cacheName: this.name }, 'cache miss. using default value')
    return this.#resolveDefaultValue(defaultValueFn)
  }

  /**
   * Batch get many values from the cache, minimizing roundtrips to L2 if possible
   * Returns an array of values (or undefined for missing keys) in the same order as the input keys
   */
  async getMany<T = any>(rawOptions: GetManyOptions<T>): Promise<(T | undefined | null)[]> {
    const keys = rawOptions.keys
    const options = this.#stack.defaultOptions.cloneWith(rawOptions)
    this.#options.logger.logMethod({ method: 'getMany', key: keys, cacheName: this.name, options })

    const l1Results = this.#stack.l1
      ? await this.#stack.l1.getMany(keys, options)
      : (Array.from({ length: keys.length }) as undefined[])

    const resultVector = Array.from({ length: keys.length })
    const missingIndices: number[] = []
    const missingKeys: string[] = []

    for (const [i, key] of keys.entries()) {
      const item = l1Results[i]
      const isValid = await this.#stack.isEntryValid(item)

      if (isValid && item) {
        resultVector[i] = item.entry.getValue()
        this.#stack.emit(cacheEvents.hit(key, resultVector[i], this.name))
        this.#options.logger.logL1Hit({ cacheName: this.name, key, options })
      } else {
        missingIndices.push(i)
        missingKeys.push(key)
      }
    }

    if (missingKeys.length === 0) return resultVector as (T | undefined | null)[]

    const l2Results = this.#stack.l2
      ? await this.#stack.l2.getMany(missingKeys, options)
      : (Array.from({ length: missingKeys.length }) as undefined[])

    for (const [i, key] of missingKeys.entries()) {
      const originalIdx = missingIndices[i]
      const l2Item = l2Results[i] as any
      const l1Item = l1Results[originalIdx] as any

      const isL2Valid = await this.#stack.isEntryValid(l2Item)

      if (isL2Valid) {
        const value = l2Item!.entry.getValue()
        resultVector[originalIdx] = value

        this.#stack.l1?.set(key, l2Item!.entry.serialize(), options)

        this.#stack.emit(cacheEvents.hit(key, value, this.name))
        this.#options.logger.logL2Hit({ cacheName: this.name, key, options })
        continue
      }

      if (options.isGraceEnabled()) {
        if (l2Item?.isGraced) {
          const value = l2Item.entry.getValue()
          resultVector[originalIdx] = value

          this.#stack.l1?.set(key, l2Item.entry.serialize(), options)

          this.#stack.emit(cacheEvents.hit(key, value, this.name, 'l2', true))
          this.#options.logger.logL2Hit({ cacheName: this.name, key, options, graced: true })
          continue
        }

        if (l1Item?.isGraced) {
          const value = l1Item.entry.getValue()
          resultVector[originalIdx] = value

          this.#stack.emit(cacheEvents.hit(key, value, this.name, 'l1', true))
          this.#options.logger.logL1Hit({ cacheName: this.name, key, options, graced: true })
          continue
        }
      }

      resultVector[originalIdx] = this.#resolveDefaultValue(rawOptions.defaultValue)
      this.#stack.emit(cacheEvents.miss(key, this.name))
    }

    return resultVector as (T | undefined | null)[]
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

    this.#stack.l1?.delete(key, options)
    await this.#stack.l2?.delete(key, options)

    this.#stack.emit(cacheEvents.deleted(key, this.name))
    await this.#stack.publish({ type: CacheBusMessageType.Delete, keys: [key] })

    return true
  }

  /**
   * Invalidate all keys with the given tags
   */
  async deleteByTag(rawOptions: DeleteByTagOptions): Promise<boolean> {
    const tags = rawOptions.tags
    const options = this.#stack.defaultOptions.cloneWith(rawOptions)

    this.#options.logger.logMethod({ method: 'deleteByTag', cacheName: this.name, tags, options })

    return await this.#stack.createTagInvalidations(tags)
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

    this.#stack.l1?.deleteMany(keys, options)
    await this.#stack.l2?.deleteMany(keys, options)

    keys.forEach((key) => this.#stack.emit(cacheEvents.deleted(key, this.name)))
    await this.#stack.publish({ type: CacheBusMessageType.Delete, keys })

    return true
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

    await Promise.all([
      this.#stack.l1?.clear(),
      this.#stack.l2?.clear(options),
      this.#stack.publish({ type: CacheBusMessageType.Clear, keys: [] }),
    ])

    this.#stack.emit(cacheEvents.cleared(this.name))
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
