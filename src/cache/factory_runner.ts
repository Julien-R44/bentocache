import type { MutexInterface } from 'async-mutex'

import pTimeout from 'p-timeout'

import type { Locks } from './locks.js'
import * as exceptions from '../errors.js'
import { events } from '../events/index.js'
import type { Factory } from '../types/helpers.js'
import type { CacheStack } from './stack/cache_stack.js'
import type { CacheStackWriter } from './stack/cache_stack_writer.js'
import type { CacheItemOptions } from './cache_item/cache_item_options.js'

/**
 * Factory Runner is responsible for executing factories
 */
export class FactoryRunner {
  #stack: CacheStack
  #stackWriter: CacheStackWriter
  #locks: Locks

  constructor(stack: CacheStack, stackWriter: CacheStackWriter, locks: Locks) {
    this.#stack = stack
    this.#stackWriter = stackWriter
    this.#locks = locks
  }

  async saveBackgroundFactoryResult(
    key: string,
    factoryResult: unknown,
    options: CacheItemOptions,
    lockReleaser: MutexInterface.Releaser
  ) {
    await this.#stackWriter.set(key, factoryResult, options)
    this.#locks.release(key, lockReleaser)
  }

  async writeFactoryResult(
    key: string,
    item: unknown,
    options: CacheItemOptions,
    lockReleaser: MutexInterface.Releaser
  ) {
    await this.#stackWriter.set(key, item, options)

    this.#stack.emit(new events.CacheMiss(key, this.#stack.name))
    this.#stack.logger.trace({ key, cache: this.#stack.name, opId: options.id }, 'cache miss')
    this.#locks.release(key, lockReleaser)
  }

  async run(
    key: string,
    factory: Factory,
    hasFallback: boolean,
    options: CacheItemOptions,
    lockReleaser: MutexInterface.Releaser
  ) {
    const timeoutDuration = options.factoryTimeout(hasFallback)
    const timeoutException =
      timeoutDuration === options.timeouts?.hard
        ? exceptions.E_FACTORY_HARD_TIMEOUT
        : exceptions.E_FACTORY_SOFT_TIMEOUT

    const promisifiedFactory = async () => await factory()

    const factoryPromise = promisifiedFactory()

    const factoryResult = await pTimeout(factoryPromise, {
      milliseconds: timeoutDuration ?? Number.POSITIVE_INFINITY,
      fallback: async () => {
        factoryPromise.then((result) =>
          this.saveBackgroundFactoryResult(key, result, options, lockReleaser)
        )

        throw new timeoutException()
      },
    })

    await this.writeFactoryResult(key, factoryResult, options, lockReleaser)
    return factoryResult
  }
}
