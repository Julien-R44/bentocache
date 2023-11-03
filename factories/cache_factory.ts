import lodash from '@poppinss/utils/lodash'
import { getActiveTest } from '@japa/runner'

import { Cache } from '../src/cache/cache.js'
import { CacheStackFactory } from './cache_stack_factory.js'
import type { CacheStackDrivers } from '../src/types/main.js'
import { createIsomorphicDestructurable } from '../src/helpers.js'
import type { CacheStack } from '../src/cache/stack/cache_stack.js'
import type { RawBentoCacheOptions } from '../src/types/options/options.js'

/**
 * Creates a new cache instance for easy and quick
 * testing
 */
export class CacheFactory {
  #stack?: CacheStack
  #parameters: Partial<RawBentoCacheOptions & CacheStackDrivers> = {}
  enabledL1L2Config: boolean = false

  #cleanupCache(cache: Cache) {
    getActiveTest()?.cleanup(async () => {
      await cache.clear().catch(() => {})
      await cache.disconnect().catch(() => {})
    })
  }

  #createCacheStack() {
    if (this.#stack) return this.#stack

    const factory = new CacheStackFactory()

    if (this.#parameters) factory.merge(this.#parameters)
    if (this.enabledL1L2Config) factory.withL1L2Config()

    const { stack } = factory.create()
    return stack
  }

  /**
   * Attach a specific cache stack
   */
  withCacheStack(stack: CacheStack) {
    this.#stack = stack
    return this
  }

  merge(parameters: Partial<RawBentoCacheOptions & CacheStackDrivers>) {
    this.#parameters = lodash.merge({}, this.#parameters, parameters)
    return this
  }

  withL1L2Config() {
    this.enabledL1L2Config = true
    return this
  }

  /**
   * Create the final cache instance
   *
   * @param autoCleanup Whether to automatically disconnect and
   *   clear the cache instance after the test
   */
  create(autoCleanup = true) {
    const stack = this.#createCacheStack()
    const cache = new Cache('primary', stack)

    const local = stack.l1!
    const remote = stack.l2!

    if (autoCleanup) this.#cleanupCache(cache)

    return createIsomorphicDestructurable(
      { cache, local, remote, stack } as const,
      [cache, local, remote, stack] as const
    )
  }
}
