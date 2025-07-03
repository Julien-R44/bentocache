import { is } from '@julr/utils/is'

import { Bus } from '../bus/bus.js'
import type { Logger } from '../logger.js'
import { TagSystem } from './tag_system.js'
import { UndefinedValueError } from '../errors.js'
import { LocalCache } from './facades/local_cache.js'
import { BaseDriver } from '../drivers/base_driver.js'
import { RemoteCache } from './facades/remote_cache.js'
import { cacheEvents } from '../events/cache_events.js'
import type { GetSetHandler } from './get_set/get_set_handler.js'
import type { BentoCacheOptions } from '../bento_cache_options.js'
import type { GetCacheValueReturn } from '../types/internals/index.js'
import type { CacheEntryOptions } from './cache_entry/cache_entry_options.js'
import { createCacheEntryOptions } from './cache_entry/cache_entry_options.js'
import {
  type BusDriver,
  type BusOptions,
  type CacheEvent,
  type CacheStackDrivers,
  type CacheBusMessage,
  CacheBusMessageType,
} from '../types/main.js'

export class CacheStack extends BaseDriver {
  l1?: LocalCache
  l2?: RemoteCache
  bus?: Bus
  defaultOptions: ReturnType<typeof createCacheEntryOptions>
  logger: Logger
  #busDriver?: BusDriver
  #busOptions?: BusOptions
  #tagSystem: TagSystem
  #namespaceCache: Map<string, CacheStack> = new Map()

  constructor(
    public name: string,
    public options: BentoCacheOptions,
    drivers: CacheStackDrivers,
    bus?: Bus,
  ) {
    super(options)
    this.logger = options.logger.child({ cache: this.name })

    if (drivers.l1Driver)
      this.l1 = new LocalCache(
        drivers.l1Driver,
        this.logger,
        this.options.serializeL1 ? this.options.serializer : undefined,
      )
    if (drivers.l2Driver)
      this.l2 = new RemoteCache(drivers.l2Driver, this.logger, !!this.l1, this.options)

    this.bus = bus ? bus : this.#createBus(drivers.busDriver, drivers.busOptions)
    if (this.l1) this.bus?.manageCache(this.prefix, this.l1)

    this.#tagSystem = new TagSystem(this)
    this.defaultOptions = createCacheEntryOptions(this.options)
  }

  get emitter() {
    return this.options.emitter
  }

  #createBus(busDriver?: BusDriver, busOptions?: BusOptions) {
    if (!busDriver) return

    this.#busDriver = busDriver
    this.#busOptions = {
      retryQueue: { enabled: true, maxSize: undefined },
      ...busOptions,
    }

    return new Bus(this.name, this.#busDriver, this.logger, this.emitter, this.#busOptions)
  }

  setTagSystemGetSetHandler(getSetHandler: GetSetHandler) {
    this.#tagSystem.setGetSetHandler(getSetHandler)
  }

  namespace(namespace: string): CacheStack {
    if (!this.#namespaceCache.has(namespace)) {
      this.#namespaceCache.set(
        namespace,
        new CacheStack(
          this.name,
          this.options.cloneWith({ prefix: this.createNamespacePrefix(namespace) }),
          {
            l1Driver: this.l1?.namespace(namespace),
            l2Driver: this.l2?.namespace(namespace),
          },
          this.bus,
        ),
      )
    }

    return <CacheStack>this.#namespaceCache.get(namespace)
  }

  /**
   * Publish a message to the bus channel
   *
   * @returns true if the message was published, false if not
   * and undefined if a bus is not part of the stack
   */
  async publish(
    message: CacheBusMessage,
    options?: CacheEntryOptions,
  ): Promise<boolean | undefined> {
    if (options?.skipBusNotify) return

    return this.bus?.publish({ ...message, namespace: this.prefix })
  }

  emit(event: CacheEvent) {
    return this.emitter.emit(event.name, event.data)
  }

  /**
   * Write a value in the cache stack
   * - Set value in local cache
   * - Set value in remote cache
   * - Publish a message to the bus
   * - Emit a CacheWritten event
   */
  async set(key: string, value: any, options: CacheEntryOptions) {
    if (is.undefined(value)) throw new UndefinedValueError(key)

    const rawItem = {
      value,
      logicalExpiration: options.logicalTtlFromNow(),
      tags: options.tags,
      createdAt: Date.now(),
    }

    /**
     * Store raw or serialized value in the local cache based on the serializeL1 option
     */
    const l1Item = this.options.serializeL1 ? this.options.serializer.serialize(rawItem) : rawItem
    this.l1?.set(key, l1Item, options)

    /**
     * Store the serialized value in the remote cache
     */
    let l2Success = false
    if (this.l2 && options.skipL2Write !== true) {
      const l2Item = this.options.serializeL1 ? l1Item : this.options.serializer.serialize(rawItem)
      l2Success = await this.l2?.set(key, l2Item as any, options)
    }

    /**
     * Publish only if the remote cache write was successful.
     */
    if ((this.l2 && l2Success) || !this.l2) {
      await this.publish({ type: CacheBusMessageType.Set, keys: [key] }, options)
    }

    this.emit(cacheEvents.written(key, value, this.name))
    return true
  }

  /**
   * Expire a key from the cache.
   * Entry will not be fully deleted but expired and
   * retained for the grace period if enabled.
   */
  async expire(key: string, options: CacheEntryOptions) {
    this.l1?.logicallyExpire(key, options)
    await this.l2?.logicallyExpire(key, options)
    await this.publish({ type: CacheBusMessageType.Expire, keys: [key] })

    this.emit(cacheEvents.expire(key, this.name))
    return true
  }

  /**
   * Check if an item is valid.
   * Valid means :
   * - Logically not expired ( not graced )
   * - Not invalidated by a tag
   * - Not marked for hard deletion by a tag
   */
  isEntryValid(item: GetCacheValueReturn | undefined): boolean | Promise<boolean> {
    if (!item) return false

    const isGraced = item?.isGraced === true
    if (isGraced) return false

    if (item.entry.getTags().length === 0) return true

    // If we have tags, we need to check both hard deletion and soft invalidation
    // Run both checks in parallel for better performance
    return Promise.all([
      this.#tagSystem.isTagHardDeleted(item.entry),
      this.#tagSystem.isTagInvalidated(item.entry),
    ]).then(async ([isHardDeleted, isTagInvalidated]) => {
      if (isHardDeleted) {
        // Immediately delete from all layers and return false
        await this.#deleteFromAllLayers(item.entry.getKey())
        return false
      }

      return !isTagInvalidated
    })
  }

  /**
   * Helper method to delete a key from all cache layers
   */
  async #deleteFromAllLayers(key: string) {
    this.l1?.delete(key)
    await this.l2?.delete(key, this.defaultOptions)
    await this.publish({ type: CacheBusMessageType.Delete, keys: [key] })
    this.emit(cacheEvents.deleted(key, this.name))
  }

  /**
   * Create invalidation keys for a list of tags
   */
  async createTagInvalidations(tags: string[]) {
    return this.#tagSystem.createTagInvalidations(tags)
  }

  /**
   * Create hard deletion marks for a list of tags
   */
  async createTagDeletionTimestamps(tags: string[]) {
    const result = await this.#tagSystem.createTagDeletionTimestamps(tags)

    // Also notify other instances via bus that these tags have been marked for deletion
    if (this.bus) {
      await this.publish({
        type: 'cache:tags:deletion-marked' as any,
        keys: tags.map((tag) => this.#tagSystem.getDeletionTagCacheKey(tag)),
      })
    }

    return result
  }
}
