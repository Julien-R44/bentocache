import pTimeout from 'p-timeout'
import { tryAsync } from '@julr/utils/functions'
import type { MutexInterface } from 'async-mutex'

import { errors } from '../errors.js'
import type { Locks } from './locks.js'
import type { CacheStack } from './cache_stack.js'
import type { GetSetFactory } from '../types/helpers.js'
import type { CacheEntryOptions } from './cache_entry/cache_entry_options.js'

interface RunFactoryParameters {
  key: string
  factory: GetSetFactory
  options: CacheEntryOptions
  lockReleaser: MutexInterface.Releaser
  isBackground?: boolean
}

/**
 * Factory Runner is responsible for executing factories
 */
export class FactoryRunner {
  #locks: Locks
  #stack: CacheStack
  #skipSymbol = Symbol('bentocache.skip')

  constructor(stack: CacheStack, locks: Locks) {
    this.#stack = stack
    this.#locks = locks
  }

  /**
   * Process a factory error
   */
  #processFactoryError(params: RunFactoryParameters, error: Error | null) {
    this.#stack.logger.warn(
      { cache: this.#stack.name, opId: params.options.id, key: params.key, err: error },
      'factory failed',
    )

    this.#locks.release(params.key, params.lockReleaser)

    const factoryError = new errors.E_FACTORY_ERROR(params.key, error, params.isBackground)
    params.options.onFactoryError?.(factoryError)

    if (!params.isBackground) throw factoryError
    return
  }

  async #runFactory(params: RunFactoryParameters) {
    params.isBackground ??= false

    /**
     * Execute the factory
     */
    const [result, error] = await tryAsync(async () => {
      const result = await params.factory({
        setTtl: (ttl) => params.options.setLogicalTtl(ttl),
        skip: () => this.#skipSymbol as any as undefined,
        fail: (message) => {
          throw new Error(message ?? 'Factory failed')
        },
      })

      this.#stack.logger.info(
        { cache: this.#stack.name, opId: params.options.id, key: params.key },
        'factory success',
      )

      return result
    })

    if (this.#skipSymbol === result) {
      this.#locks.release(params.key, params.lockReleaser)
      return
    }

    /**
     * If the factory has thrown an error, we will log it and throw a FactoryError
     * after releasing the lock
     */
    if (error) return this.#processFactoryError(params, error)

    /**
     * Save the factory result in the catch
     */
    try {
      await this.#stack.set(params.key, result, params.options)
    } finally {
      this.#locks.release(params.key, params.lockReleaser)
    }

    return result
  }

  async run(
    key: string,
    factory: GetSetFactory,
    hasFallback: boolean,
    options: CacheEntryOptions,
    lockReleaser: MutexInterface.Releaser,
  ) {
    const timeout = options.factoryTimeout(hasFallback)
    if (timeout) {
      this.#stack.logger.info(
        { cache: this.#stack.name, opId: options.id, key },
        `running factory with ${timeout.type} timeout of ${timeout.duration}ms`,
      )
    } else {
      this.#stack.logger.info({ cache: this.#stack.name, opId: options.id, key }, 'running factory')
    }

    /**
     * If the timeout is 0, we will not wait for the factory to resolve
     * And immediately return the fallback value
     */
    if (options.shouldSwr(hasFallback)) {
      this.#runFactory({ key, factory, options, lockReleaser, isBackground: true })
      throw new errors.E_FACTORY_SOFT_TIMEOUT(key)
    }

    const runFactory = this.#runFactory({ key, factory, options, lockReleaser })
    const result = await pTimeout(runFactory, {
      milliseconds: timeout?.duration ?? Number.POSITIVE_INFINITY,
      fallback: async () => {
        this.#stack.logger.warn(
          { cache: this.#stack.name, opId: options.id, key },
          `factory timed out after ${timeout?.duration}ms`,
        )
        throw new timeout!.exception(key)
      },
    })

    return result
  }
}
