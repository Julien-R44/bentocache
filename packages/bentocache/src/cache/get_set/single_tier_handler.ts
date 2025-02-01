import type { MutexInterface } from 'async-mutex'

import { Locks } from '../locks.js'
import { events } from '../../events/index.js'
import { FactoryRunner } from '../factory_runner.js'
import type { Factory } from '../../types/helpers.js'
import type { CacheEvent } from '../../types/events.js'
import { E_FACTORY_SOFT_TIMEOUT } from '../../errors.js'
import type { CacheStack } from '../stack/cache_stack.js'
import type { CacheEntry } from '../cache_entry/cache_entry.js'
import type { CacheStackWriter } from '../stack/cache_stack_writer.js'
import type { CacheEntryOptions } from '../cache_entry/cache_entry_options.js'

export class SingleTierHandler {
  /**
   * A map that will hold active locks for each key
   */
  #locks = new Locks()
  #factoryRunner: FactoryRunner

  constructor(
    protected stack: CacheStack,
    protected stackWriter: CacheStackWriter,
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
   * Returns a value from the remote cache and emit a CacheHit event
   */
  async #returnRemoteCacheValue(key: string, item: CacheEntry, options: CacheEntryOptions) {
    this.logger.trace({ key, cache: this.stack.name, opId: options.id }, 'remote cache hit')

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
    err: Error,
  ) {
    if (options.isGraceEnabled && item) {
      const isLogicallyExpired = item.isLogicallyExpired()
      this.#emit(new events.CacheHit(key, item.getValue(), this.stack.name, isLogicallyExpired))
      this.logger.trace(
        { key, cache: this.stack.name, opId: options.id },
        'remote cache hit (graced)',
      )

      return item.getValue()
    }

    throw err
  }

  async #applyFallbackAndReturnGracedValue(
    key: string,
    item: CacheEntry,
    options: CacheEntryOptions,
  ) {
    if (options.grace && options.graceBackoff) {
      this.logger.trace(
        { key, cache: this.stack.name, opId: options.id },
        'apply fallback duration',
      )

      this.stack.l2?.set(key, item.applyBackoff(options.graceBackoff).serialize(), options)
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
    let remoteItem: CacheEntry | undefined

    /**
     * Check in the remote cache first if we have something
     */
    remoteItem = await this.stack.l2?.get(key, options)
    if (this.#isItemValid(remoteItem)) {
      return this.#returnRemoteCacheValue(key, remoteItem, options)
    }

    /**
     * If nothing is found in the remote cache, we try to acquire a lock
     * to run the factory
     */
    let releaser: MutexInterface.Releaser
    try {
      releaser = await this.#acquireLock(key, false, options)
    } catch (err) {
      return this.#returnGracedValueOrThrow(key, remoteItem, options, err)
    }

    /**
     * Check in the remote cache again, in case another process
     * already set the value
     */
    remoteItem = await this.stack.l2?.get(key, options)
    if (this.#isItemValid(remoteItem)) {
      this.#locks.release(key, releaser)
      return this.#returnRemoteCacheValue(key, remoteItem, options)
    }

    try {
      const hasFallback = !!remoteItem
      return await this.#factoryRunner.run(key, factory, hasFallback, options, releaser)
    } catch (err) {
      /**
       * If we hitted a soft timeout and we have a graced value, returns it
       */
      const staleItem = remoteItem
      if (err instanceof E_FACTORY_SOFT_TIMEOUT && staleItem) {
        return this.#returnGracedValueOrThrow(key, staleItem, options, err)
      }

      /**
       * Otherwise, that means we had a factory error. If we have a graced
       * value, returns it
       */
      this.logger.trace(
        { key, cache: this.stack.name, opId: options.id, error: err },
        'factory error',
      )

      if (staleItem && options.isGraceEnabled) {
        this.#locks.release(key, releaser)
        return this.#applyFallbackAndReturnGracedValue(key, staleItem, options)
      }

      this.#locks.release(key, releaser)
      throw err
    }
  }
}
