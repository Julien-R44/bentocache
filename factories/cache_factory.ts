/*
 * @blizzle/bentocache
 *
 * (c) Blizzle
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import lodash from '@poppinss/utils/lodash'
import { getActiveTest } from '@japa/runner'

import { Cache } from '../src/cache/cache.js'
import { Redis } from '../src/drivers/redis.js'
import { Memory } from '../src/drivers/memory.js'
import { MemoryBus } from '../src/bus/drivers/memory_bus.js'
import { BentoCacheOptions } from '../src/bento_cache_options.js'
import { createIsomorphicDestructurable } from '../src/helpers.js'
import type {
  Emitter,
  GracePeriodOptions,
  BusDriver,
  CacheDriver,
  Logger,
  BusOptions,
} from '../src/types/main.js'

type FactoryParameters = {
  emitter: Emitter
  ttl: number
  logger: Logger
  localDriver: CacheDriver
  remoteDriver: CacheDriver
  busDriver: BusDriver
  busOptions: BusOptions
  gracePeriod: GracePeriodOptions
  earlyExpiration: number
  lockTimeout?: number
  timeouts?: {
    soft?: number
    hard?: number
  }
}

/**
 * Creates a new cache instance for easy and quick
 * testing
 */
export class CacheFactory {
  /**
   * The default parameters
   */
  #parameters: Partial<FactoryParameters> = {}

  /**
   * Instantiate and return the local driver
   */
  #createLocalDriver() {
    if (this.#parameters.localDriver) return this.#parameters.localDriver
    return new Memory({ maxItems: 100, prefix: 'test' })
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
  merge(parameters: Partial<FactoryParameters>) {
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
    // this.#parameters.busDriver =
    //   this.#parameters.busDriver ?? (new RedisBus(REDIS_CREDENTIALS) as BusDriver)

    return this
  }

  /**
   * Create the final cache instance
   *
   * @param autoCleanup Whether to automatically cleanup the cache instance after the test
   */
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

    const cache = new Cache('primary', options, {
      localDriver: local,
      remoteDriver: remote,
      busDriver: this.#parameters.busDriver,
      busOptions: this.#parameters.busOptions,
    })

    if (autoCleanup) {
      getActiveTest()?.cleanup(async () => {
        await cache.clear().catch(() => {})
        await cache.disconnect().catch(() => {})
      })
    }

    return createIsomorphicDestructurable(
      { cache, local, remote } as const,
      [cache, local, remote] as const
    )
  }
}
