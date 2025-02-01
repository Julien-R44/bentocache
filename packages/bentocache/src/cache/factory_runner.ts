import pTimeout from 'p-timeout'
import type { MutexInterface } from 'async-mutex'

import type { Locks } from './locks.js'
import * as exceptions from '../errors.js'
import type { GetSetFactory } from '../types/helpers.js'
import type { CacheStackWriter } from './stack/cache_stack_writer.js'
import type { CacheEntryOptions } from './cache_entry/cache_entry_options.js'

/**
 * Factory Runner is responsible for executing factories
 */
export class FactoryRunner {
  #stackWriter: CacheStackWriter
  #locks: Locks

  constructor(stackWriter: CacheStackWriter, locks: Locks) {
    this.#stackWriter = stackWriter
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
      })

      await this.#stackWriter.set(key, result, options)
      return result
    } catch (error) {
      if (!isBackground) throw error

      // TODO Global error handler
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
      throw new exceptions.E_FACTORY_SOFT_TIMEOUT()
    }

    const runFactory = this.#runFactory(key, factory, options, lockReleaser)
    const result = await pTimeout(runFactory, {
      milliseconds: timeout?.duration ?? Number.POSITIVE_INFINITY,
      fallback: async () => {
        throw new timeout!.exception()
      },
    })

    return result
  }
}
