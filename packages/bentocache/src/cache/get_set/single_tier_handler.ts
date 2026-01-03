import type { MutexInterface } from 'async-mutex'

import { Locks } from '../locks.js'
import { errors } from '../../errors.js'
import type { CacheStack } from '../cache_stack.js'
import { FactoryRunner } from '../factory_runner.js'
import type { Factory } from '../../types/helpers.js'
import type { CacheEvent } from '../../types/events.js'
import { cacheEvents } from '../../events/cache_events.js'
import { cacheOperation } from '../../tracing_channels.js'
import type { GetCacheValueReturn } from '../../types/internals/index.js'
import type { CacheOperationMessage } from '../../types/tracing_channels.js'
import type { CacheEntryOptions } from '../cache_entry/cache_entry_options.js'

export class SingleTierHandler {
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
   * Returns a value from the remote cache and emit a CacheHit event
   */
  async #returnRemoteCacheValue(
    key: string,
    item: GetCacheValueReturn,
    options: CacheEntryOptions,
    message?: CacheOperationMessage,
  ) {
    if (message) {
      message.hit = true
      message.tier = 'l2'
    }

    this.logger.logL2Hit({ cacheName: this.stack.name, key, options })

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
    message?: CacheOperationMessage,
  ) {
    if (options.isGraceEnabled() && item) {
      if (message) {
        message.hit = true
        message.tier = 'l2'
        message.graced = item.isGraced
      }

      this.#emit(cacheEvents.hit(key, item.entry.getValue(), this.stack.name, 'l2', item.isGraced))
      return item.entry.getValue()
    }

    throw err
  }

  async #applyFallbackAndReturnGracedValue(
    key: string,
    item: GetCacheValueReturn,
    options: CacheEntryOptions,
    message?: CacheOperationMessage,
  ) {
    if (options.grace && options.graceBackoff) {
      this.logger.trace(
        { key, cache: this.stack.name, opId: options.id },
        'apply fallback duration',
      )

      this.stack.l2?.set(
        key,
        item.entry.applyBackoff(options.graceBackoff).serialize() as any,
        options,
      )
    }

    if (message) {
      message.hit = true
      message.tier = 'l2'
      message.graced = true
    }

    this.logger.trace({ key, cache: this.stack.name, opId: options.id }, 'returns stale value')
    this.#emit(cacheEvents.hit(key, item.entry.getValue(), this.stack.name, 'l2', true))
    return item.entry.getValue()
  }

  async #handleInternal(
    key: string,
    factory: Factory,
    options: CacheEntryOptions,
    message?: CacheOperationMessage,
  ) {
    /**
     * If forceFresh is not true, check in the remote cache first
     */
    let remoteItem: GetCacheValueReturn | undefined
    let isRemoteItemValid = false

    if (!options.forceFresh) {
      remoteItem = await this.stack.l2?.get(key, options)
      isRemoteItemValid = await this.stack.isEntryValid(remoteItem)
      if (isRemoteItemValid) {
        return this.#returnRemoteCacheValue(key, remoteItem!, options, message)
      }
    }

    /**
     * If nothing is found in the remote cache, or if forceFresh is true,
     * we try to acquire a lock to run the factory
     */
    let releaser: MutexInterface.Releaser
    try {
      releaser = await this.#acquireLock(key, !!remoteItem, options)
    } catch (err) {
      return this.#returnGracedValueOrThrow(key, remoteItem, options, err, message)
    }

    /**
     * If not forceFresh, check in the remote cache again, in case another process
     * already set the value
     */
    if (!options.forceFresh) {
      remoteItem = await this.stack.l2?.get(key, options)
      isRemoteItemValid = await this.stack.isEntryValid(remoteItem)
      if (isRemoteItemValid) {
        this.#locks.release(key, releaser)
        return this.#returnRemoteCacheValue(key, remoteItem!, options, message)
      }
    }

    try {
      const result = await this.#factoryRunner.run(key, factory, remoteItem, options, releaser)

      if (message) message.hit = false

      this.#emit(cacheEvents.miss(key, this.stack.name))
      return result
    } catch (err) {
      /**
       * If we hit a soft timeout and we have a graced value, returns it
       */
      const staleItem = remoteItem
      if (err instanceof errors.E_FACTORY_SOFT_TIMEOUT && staleItem) {
        return this.#returnGracedValueOrThrow(key, staleItem, options, err, message)
      }

      /**
       * Otherwise, that means we had a factory error. If we have a graced
       * value, returns it
       */
      this.logger.trace({ key, cache: this.stack.name, opId: options.id, err }, 'factory error')

      if (staleItem && options.isGraceEnabled()) {
        this.#locks.release(key, releaser)
        return this.#applyFallbackAndReturnGracedValue(key, staleItem, options, message)
      }

      this.#locks.release(key, releaser)
      throw err
    }
  }

  handle(key: string, factory: Factory, options: CacheEntryOptions) {
    const message: CacheOperationMessage = {
      operation: 'get',
      key: this.stack.getFullKey(key),
      store: this.stack.name,
    }

    return cacheOperation.tracePromise(
      () => this.#handleInternal(key, factory, options, message),
      message,
    )
  }
}
