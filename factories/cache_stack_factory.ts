import lodash from '@poppinss/utils/lodash'
import { getActiveTest } from '@japa/runner'

import { Cache } from '../src/cache/cache.js'
import { Redis } from '../src/drivers/redis.js'
import { Memory } from '../src/drivers/memory.js'
import { MemoryBus } from '../src/bus/drivers/memory_bus.js'
import { CacheStack } from '../src/cache/stack/cache_stack.js'
import { BentoCacheOptions } from '../src/bento_cache_options.js'
import { createIsomorphicDestructurable } from '../src/helpers.js'
import type { CacheStackDrivers, RawBentoCacheOptions } from '../src/types/main.js'

export class CacheStackFactory {
  #parameters: Partial<RawBentoCacheOptions & CacheStackDrivers> = {}

  #cleanupStack(stack: CacheStack) {
    const cache = new Cache('primary', stack)

    getActiveTest()?.cleanup(async () => {
      await cache.clear().catch(() => {})
      await cache.disconnect().catch(() => {})
    })
  }

  /**
   * Instantiate and return the local driver
   */
  #createLocalDriver() {
    if (this.#parameters.localDriver) return this.#parameters.localDriver
    return new Memory({ maxSize: 100, prefix: 'test' })
  }

  /**
   * Instantiate and return the remote driver
   */
  #createRemoteDriver() {
    if (this.#parameters.remoteDriver) return this.#parameters.remoteDriver
    return new Redis({ connection: { host: '127.0.0.1', port: 6379 }, prefix: 'test' })
  }

  /**
   * Merge custom parameters with the default parameters
   */
  merge(parameters: Partial<RawBentoCacheOptions & CacheStackDrivers>) {
    this.#parameters = lodash.merge({}, this.#parameters, parameters)
    return this
  }

  /**
   * Apply the hybrid driver configuration to the factory
   */
  withHybridConfig() {
    this.#parameters.localDriver = this.#createLocalDriver()
    this.#parameters.remoteDriver = this.#createRemoteDriver()
    this.#parameters.busDriver = this.#parameters.busDriver ?? new MemoryBus()

    return this
  }

  /**
   * Add grace period of 6 hours and timeouts of 1s and 2s
   */
  withGraceAndTimeouts() {
    this.#parameters.gracePeriod = { enabled: true, duration: '6h', fallbackDuration: 1000 }
    this.#parameters.timeouts = { soft: '300ms', hard: '800ms' }

    return this
  }

  create(autoCleanup = true) {
    const local = this.#createLocalDriver()
    const remote = this.#createRemoteDriver()

    const options = new BentoCacheOptions({
      ttl: this.#parameters.ttl,
      gracePeriod: this.#parameters.gracePeriod,
      earlyExpiration: this.#parameters.earlyExpiration,
      timeouts: this.#parameters.timeouts,
      logger: this.#parameters.logger,
      emitter: this.#parameters.emitter,
      lockTimeout: this.#parameters.lockTimeout,
    })

    const stack = new CacheStack('primary', options, {
      localDriver: local,
      remoteDriver: remote,
      busDriver: this.#parameters.busDriver,
      busOptions: this.#parameters.busOptions,
    })

    if (autoCleanup) this.#cleanupStack(stack)

    return createIsomorphicDestructurable(
      { stack, local, remote } as const,
      [stack, local, remote] as const
    )
  }
}
