import type { MutexInterface } from 'async-mutex'

import { Locks } from '../locks.js'
import { errors } from '../../errors.js'
import type { CacheStack } from '../cache_stack.js'
import { FactoryRunner } from '../factory_runner.js'
import type { Factory } from '../../types/helpers.js'
import type { CacheEvent } from '../../types/events.js'
import { cacheEvents } from '../../events/cache_events.js'
import type { GetCacheValueReturn } from '../../types/internals/index.js'
import type { CacheEntryOptions } from '../cache_entry/cache_entry_options.js'

export class TwoTierHandler {
  /**
   * A map that will hold active locks for each key
   */
  #locks = new Locks()
  #factoryRunner: FactoryRunner

  constructor(protected stack: CacheStack) {
    this.#factoryRunner = new FactoryRunner(this.stack, this.#locks)
  }

  get logger() {
    return this.stack.logger
  }

  /**
   * Emit a CacheEvent using the emitter
   */
  #emit(event: CacheEvent) {
    return this.stack.emitter.emit(event.name, event.data)
  }

  /**
   * Returns a value from the local cache and emit a CacheHit event
   */
  #returnL1Value(key: string, item: GetCacheValueReturn) {
    this.#emit(cacheEvents.hit(key, item.entry.getValue(), this.stack.name, 'l1', item.isGraced))
    return item.entry.getValue()
  }

  /**
   * Returns a value from the remote cache and emit a CacheHit event
   */
  async #returnRemoteCacheValue(
    key: string,
    item: GetCacheValueReturn,
    options: CacheEntryOptions,
  ) {
    this.stack.l1?.set(key, item.entry.serialize(), options)

    this.#emit(cacheEvents.hit(key, item.entry.getValue(), this.stack.name, 'l2'))
    return item.entry.getValue()
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
    item: GetCacheValueReturn | undefined,
    options: CacheEntryOptions,
    err: Error,
  ) {
    if (options.isGraceEnabled() && item) return this.#returnL1Value(key, item)
    throw err
  }

  async #applyFallbackAndReturnGracedValue(
    key: string,
    item: GetCacheValueReturn,
    layer: 'l1' | 'l2',
    options: CacheEntryOptions,
  ) {
    if (options.grace && options.graceBackoff) {
      this.logger.trace(
        { key, cache: this.stack.name, opId: options.id },
        'apply fallback duration',
      )

      this.stack.l1?.set(key, item.entry.applyBackoff(options.graceBackoff).serialize(), options)
    }

    this.logger.trace({ key, cache: this.stack.name, opId: options.id }, 'returns stale value')
    this.#emit(cacheEvents.hit(key, item.entry.getValue(), this.stack.name, layer, true))
    return item.entry.getValue()
  }

  async #lockAndHandle(
    key: string,
    factory: Factory,
    options: CacheEntryOptions,
    localItem?: GetCacheValueReturn,
  ) {
    /**
     * Since we didn't find a valid item in the local cache, we need to
     * check the remote cache, or invoke the factory.
     *
     * We acquire a lock to prevent a cache stampede.
     */
    let releaser: MutexInterface.Releaser
    try {
      this.logger.trace({ key, cache: this.stack.name, opId: options.id }, 'acquiring lock...')
      releaser = await this.#acquireLock(key, !!localItem, options)
    } catch (err) {
      this.logger.trace({ key, cache: this.stack.name, opId: options.id }, 'lock failed')
      return this.#returnGracedValueOrThrow(key, localItem, options, err)
    }

    this.logger.trace({ key, cache: this.stack.name, opId: options.id }, 'acquired lock')

    let remoteItem
    if (!options.forceFresh) {
      /**
       * Check local cache again, as another process could have written a value
       * while we were waiting for the lock.
       */
      localItem = this.stack.l1?.get(key, options)
      const isLocalItemValid = await this.stack.isEntryValid(localItem)
      if (isLocalItemValid) {
        this.#locks.release(key, releaser)
        return this.#returnL1Value(key, localItem!)
      }

      /**
       * Check remote cache in case something was written there
       */
      remoteItem = await this.stack.l2?.get(key, options)
      const isRemoteItemValid = await this.stack.isEntryValid(remoteItem)
      if (isRemoteItemValid) {
        this.#locks.release(key, releaser)
        return this.#returnRemoteCacheValue(key, remoteItem!, options)
      }
    }

    try {
      const gracedValue = localItem || remoteItem
      const result = await this.#factoryRunner.run(key, factory, gracedValue, options, releaser)
      this.#emit(cacheEvents.miss(key, this.stack.name))

      return result
    } catch (err) {
      /**
       * If we hit a soft timeout and we have a graced value, returns it
       */
      const staleItem = remoteItem ?? localItem
      if (err instanceof errors.E_FACTORY_SOFT_TIMEOUT && staleItem) {
        return this.#returnGracedValueOrThrow(key, staleItem, options, err)
      }

      /**
       * Otherwise, that means we had a factory error. If we have a graced
       * value, returns it
       */
      this.logger.trace({ key, cache: this.stack.name, opId: options.id, err }, 'factory error')

      if (staleItem && options.isGraceEnabled()) {
        this.#locks.release(key, releaser)
        return this.#applyFallbackAndReturnGracedValue(
          key,
          staleItem,
          staleItem === localItem ? 'l1' : 'l2',
          options,
        )
      }

      this.#locks.release(key, releaser)
      throw err
    }
  }

  handle(key: string, factory: Factory, options: CacheEntryOptions) {
    if (options.forceFresh) return this.#lockAndHandle(key, factory, options)

    /**
     * First we check the local cache. If we have a valid item, just
     * returns it without acquiring a lock.
     */
    const localItem = this.stack.l1?.get(key, options)
    const isLocalItemValid = this.stack.isEntryValid(localItem)

    // A bit nasty, but to keep maximum performance, we avoid async/await here.
    // Let's check for a better way to handle this later.
    if (isLocalItemValid instanceof Promise) {
      return isLocalItemValid.then((valid) => {
        if (valid) return this.#returnL1Value(key, localItem!)
        return this.#lockAndHandle(key, factory, options, localItem)
      })
    }

    if (isLocalItemValid) return this.#returnL1Value(key, localItem!)

    /**
     * Next, delegate to the lock-and-handle async method so we can keep
     * this method synchronous and avoid an overhead of async/await
     * in case we have a valid item in the local cache.
     */
    return this.#lockAndHandle(key, factory, options, localItem)
  }
}
