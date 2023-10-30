import type { MutexInterface } from 'async-mutex'

import { Locks } from './locks.js'
import { events } from '../events/index.js'
import type { Factory } from '../types/helpers.js'
import { FactoryRunner } from './factory_runner.js'
import type { CacheEvent } from '../types/events.js'
import { E_FACTORY_SOFT_TIMEOUT } from '../errors.js'
import type { CacheStack } from './stack/cache_stack.js'
import type { CacheEntry } from './cache_entry/cache_entry.js'
import type { CacheStackWriter } from './stack/cache_stack_writer.js'
import type { CacheEntryOptions } from './cache_entry/cache_entry_options.js'

export class GetSetHandler {
  /**
   * A map that will hold active locks for each key
   */
  #locks = new Locks()
  #factoryRunner: FactoryRunner

  constructor(
    protected stack: CacheStack,
    protected stackWriter: CacheStackWriter
  ) {
    this.#factoryRunner = new FactoryRunner(this.stack, this.stackWriter, this.#locks)
  }

  get logger() {
    return this.stack.logger
  }

  get emitter() {
    return this.stack.emitter
  }

  /**
   * Emit a CacheEvent using the emitter
   */
  #emit(event: CacheEvent) {
    return this.stack.emitter.emit(event.name, event.toJSON())
  }

  /**
   * Refresh a cache item before it expires
   */
  async #earlyExpirationRefresh(key: string, factory: Factory, options: CacheEntryOptions) {
    this.logger.debug({ key, name: this.stack.name, opId: options.id }, 'try to early refresh')
    let lock = this.#locks.getOrCreateForKey(key)

    /**
     * If lock is already acquired, then just exit. We only want to run
     * the factory once, in background.
     */
    if (lock.isLocked()) {
      return
    }

    await lock
      .runExclusive(async () => {
        this.logger.trace(
          { key, cache: this.stack.name, opId: options.id },
          'acquired lock for refresh'
        )

        await this.stackWriter.set(key, await factory(), options)
      })
      .catch((error) => {
        const msg = 'factory error in early refresh'
        this.logger.error({ key, cache: this.stack.name, opId: options.id, error }, msg)

        throw error
      })
  }

  /**
   * Returns a value from the local cache and emit a CacheHit event
   */
  #returnLocalCacheValue(
    key: string,
    item: CacheEntry,
    options: CacheEntryOptions,
    logMsg?: string
  ) {
    const isLogicallyExpired = item.isLogicallyExpired()
    logMsg = logMsg ?? 'local cache hit'

    this.#emit(new events.CacheHit(key, item.getValue(), this.stack.name, isLogicallyExpired))
    this.logger.trace({ key, cache: this.stack.name, opId: options.id }, logMsg)

    return item.getValue()
  }

  /**
   * Returns a value from the remote cache and emit a CacheHit event
   */
  async #returnRemoteCacheValue(key: string, item: CacheEntry, options: CacheEntryOptions) {
    this.logger.trace({ key, cache: this.stack.name, opId: options.id }, 'remote cache hit')

    await this.stack.l1?.set(key, item.serialize(), options)

    this.#emit(new events.CacheHit(key, item.getValue(), this.stack.name))
    return item.getValue()
  }

  /**
   * Try acquiring a lock for a key
   *
   * If we have a fallback value, grace period enabled, and a soft timeout configured
   * we will wait at most the soft timeout to acquire the lock
   */
  #acquireLock(key: string, hasFallback: boolean, options: CacheEntryOptions) {
    const lock = this.#locks.getOrCreateForKey(key, options.getApplicableLockTimeout(hasFallback))
    return lock.acquire()
  }

  #returnGracedValueOrThrow(
    key: string,
    item: CacheEntry | undefined,
    options: CacheEntryOptions,
    err: Error
  ) {
    if (options.isGracePeriodEnabled && item) {
      return this.#returnLocalCacheValue(key, item, options, 'local cache hit (graced)')
    }

    throw err
  }

  async #applyFallbackAndReturnGracedValue(
    key: string,
    item: CacheEntry,
    options: CacheEntryOptions
  ) {
    if (options.gracePeriod.enabled && options.gracePeriod.fallbackDuration) {
      this.logger.trace(
        { key, cache: this.stack.name, opId: options.id },
        'apply fallback duration'
      )

      await this.stack.l1?.set(
        key,
        item.applyFallbackDuration(options.gracePeriod.fallbackDuration).serialize(),
        options
      )
    }

    this.logger.trace({ key, cache: this.stack.name, opId: options.id }, 'returns stale value')
    this.#emit(new events.CacheHit(key, item.getValue(), this.stack.name, true))
    return item.getValue()
  }

  /**
   * Check if a cache item is not undefined and not logically expired
   */
  #isItemValid(item: CacheEntry | undefined): item is CacheEntry {
    return !!item && !item.isLogicallyExpired()
  }

  async handle(key: string, factory: Factory, options: CacheEntryOptions) {
    let localItem: CacheEntry | undefined
    let remoteItem: CacheEntry | undefined

    /**
     * First we check the local cache. If we have a valid item, just
     * returns it without acquiring a lock.
     */
    localItem = await this.stack.l1?.get(key, options)
    if (this.#isItemValid(localItem)) {
      if (localItem?.isEarlyExpired()) this.#earlyExpirationRefresh(key, factory, options)
      return this.#returnLocalCacheValue(key, localItem, options)
    }

    /**
     * Since we didn't find a valid item in the local cache, we need to
     * check the remote cache, or invoke the factory.
     *
     * We acquire a lock to prevent a cache stampede.
     */
    let releaser: MutexInterface.Releaser
    try {
      releaser = await this.#acquireLock(key, !!localItem, options)
    } catch (err) {
      return this.#returnGracedValueOrThrow(key, localItem, options, err)
    }

    this.logger.trace({ key, cache: this.stack.name, opId: options.id }, 'acquired lock')

    /**
     * We need to check the local cache again, because another process
     * could have written a value while we were waiting for the lock.
     */
    localItem = await this.stack.l1?.get(key, options)
    if (this.#isItemValid(localItem)) {
      this.#locks.release(key, releaser)
      return this.#returnLocalCacheValue(key, localItem, options, 'local cache hit after lock')
    }

    /**
     * If local cache was empty, maybe there is something in the remote
     * cache. If we find a valid item, we save it in the local cache
     * and returns it.
     */
    remoteItem = await this.stack.l2?.get(key, options)
    if (this.#isItemValid(remoteItem)) {
      this.#locks.release(key, releaser)
      return this.#returnRemoteCacheValue(key, remoteItem, options)
    }

    try {
      return await this.#factoryRunner.run(key, factory, !!localItem, options, releaser)
    } catch (err) {
      /**
       * If we hitted a soft timeout and we have a graced value, returns it
       */
      if (err instanceof E_FACTORY_SOFT_TIMEOUT && localItem) {
        return this.#returnGracedValueOrThrow(key, localItem, options, err)
      }

      /**
       * Otherwise, that means we had a factory error. If we have a graced
       * value, returns it
       */
      this.logger.trace(
        { key, cache: this.stack.name, opId: options.id, error: err },
        'factory error'
      )

      const staleItem = remoteItem ?? localItem
      if (staleItem && options.isGracePeriodEnabled) {
        this.#locks.release(key, releaser)
        return this.#applyFallbackAndReturnGracedValue(key, staleItem, options)
      }

      this.#locks.release(key, releaser)
      throw err
    }
  }
}
