import pTimeout from 'p-timeout'
import type { MutexInterface } from 'async-mutex'

import { errors } from '../errors.js'
import type { Locks } from './locks.js'
import type { CacheStack } from './cache_stack.js'
import type { GetSetFactory } from '../types/helpers.js'
import type { CacheEntryOptions } from './cache_entry/cache_entry_options.js'

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

  async #runFactory(
    key: string,
    factory: GetSetFactory,
    options: CacheEntryOptions,
    lockReleaser: MutexInterface.Releaser,
    isBackground = false,
  ) {
    try {
      const result = await factory({
        setTtl: (ttl) => options.setLogicalTtl(ttl),
        skip: () => this.#skipSymbol as any as undefined,
        fail: (message) => {
          throw new Error(message ?? 'Factory failed')
        },
      })

      if (result === this.#skipSymbol) return

      await this.#stack.set(key, result, options)
      return result
    } catch (error) {
      if (error instanceof errors.E_VALIDATION_ERROR) throw error

      if (!isBackground) throw new errors.E_FACTORY_ERROR(key, error)

      options.onFactoryError?.(new errors.E_FACTORY_ERROR(key, error, true))
    } finally {
      this.#locks.release(key, lockReleaser)
    }
  }

  async run(
    key: string,
    factory: GetSetFactory,
    hasFallback: boolean,
    options: CacheEntryOptions,
    lockReleaser: MutexInterface.Releaser,
  ) {
    const timeout = options.factoryTimeout(hasFallback)

    /**
     * If the timeout is 0, we will not wait for the factory to resolve
     * And immediately return the fallback value
     */
    if (options.shouldSwr(hasFallback)) {
      this.#runFactory(key, factory, options, lockReleaser, true)
      throw new errors.E_FACTORY_SOFT_TIMEOUT(key)
    }

    const runFactory = this.#runFactory(key, factory, options, lockReleaser)
    const result = await pTimeout(runFactory, {
      milliseconds: timeout?.duration ?? Number.POSITIVE_INFINITY,
      fallback: async () => {
        throw new timeout!.exception(key)
      },
    })

    return result
  }
}
