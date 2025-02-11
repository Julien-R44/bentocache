import lodash from '@poppinss/utils/lodash'
import { getActiveTest } from '@japa/runner'
import { hybridReturn } from '@julr/utils/misc'
import { MemoryTransport } from '@boringnode/bus/transports/memory'

import { Cache } from '../src/cache/cache.js'
import { RedisDriver } from '../src/drivers/redis.js'
import { MemoryDriver } from '../src/drivers/memory.js'
import { traceLogger } from '../tests/helpers/index.js'
import { CacheStack } from '../src/cache/cache_stack.js'
import { BentoCacheOptions } from '../src/bento_cache_options.js'
import type { CacheStackDrivers, MemoryConfig } from '../src/types/main.js'
import type { RawBentoCacheOptions } from '../src/types/options/options.js'

/**
 * Creates a new cache instance for easy and quick
 * testing
 */
export class CacheFactory {
  #parameters: Partial<RawBentoCacheOptions & CacheStackDrivers> = {}
  #l1Options: MemoryConfig = {}
  enabledL1L2Config: boolean = false

  #cleanupCache(cache: Cache) {
    getActiveTest()?.cleanup(async () => {
      await cache.clear().catch(() => {})
      await cache.disconnect().catch(() => {})
    })
  }

  /**
   * Create the cache stack
   */
  #createCacheStack() {
    const options = new BentoCacheOptions({
      ...this.#parameters,
    }).serializeL1Cache(this.#l1Options.serialize ?? true)

    const stack = new CacheStack('primary', options, {
      l1Driver: this.#parameters.l1Driver,
      l2Driver: this.#parameters.l2Driver,
      busDriver: this.#parameters.busDriver,
      busOptions: this.#parameters.busOptions,
    })

    return stack
  }

  /**
   * Merge custom parameters with the default parameters
   */
  merge(parameters: Partial<RawBentoCacheOptions & CacheStackDrivers>) {
    this.#parameters = lodash.merge({}, this.#parameters, parameters)
    return this
  }

  /**
   * Adds a Memory L1 driver to the cache stack
   */
  withMemoryL1(options: MemoryConfig = {}) {
    this.#l1Options = options
    this.#parameters.l1Driver = new MemoryDriver({ prefix: 'test', ...options })
    return this
  }

  /**
   * Adds a Redis L2 driver to the cache stack
   */
  withRedisL2() {
    this.#parameters.l2Driver = new RedisDriver({ connection: { host: '127.0.0.1', port: 6379 } })
    return this
  }

  /**
   * Adds a cache stack preset with Memory + Redis + Memory Bus
   */
  withL1L2Config() {
    this.#parameters.l1Driver ??= new MemoryDriver({ maxSize: 100, prefix: 'test' })
    this.#parameters.l2Driver ??= new RedisDriver({ connection: { host: '127.0.0.1', port: 6379 } })
    this.#parameters.busDriver ??= new MemoryTransport()

    return this
  }

  /**
   * Adds a trace logger. Useful for quick debugging while testing
   */
  withTraceLogger() {
    this.#parameters.logger = traceLogger(true)
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

    return hybridReturn(
      { cache, local, remote, stack } as const,
      [cache, local, remote, stack] as const,
    )
  }
}
