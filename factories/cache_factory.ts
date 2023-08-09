/*
 * @adonisjs/cache
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import lodash from '@poppinss/utils/lodash'
import { noopLogger } from 'typescript-log'
import { getActiveTest } from '@japa/runner'
import { createId } from '@paralleldrive/cuid2'

import { Cache } from '../src/cache.js'
import { Redis } from '../src/drivers/redis.js'
import { Memory } from '../src/drivers/memory.js'
import { MemoryBus } from '../src/bus/drivers/memory_bus.js'
import { createIsomorphicDestructurable } from '../src/helpers.js'
import type {
  Emitter,
  GracefulRetainOptions,
  BusDriver,
  CacheDriver,
  Logger,
} from '../src/types/main.js'
import EventEmitter from 'node:events'

type FactoryParameters = {
  emitter: Emitter
  ttl: number
  logger: Logger
  localDriver: CacheDriver
  remoteDriver: CacheDriver
  busDriver: BusDriver
  gracefulRetain: GracefulRetainOptions
  earlyExpiration: number
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
  #parameters: Partial<FactoryParameters> = {
    gracefulRetain: { enabled: false },
  }

  /**
   * Instantiate and return the local driver
   */
  #createLocalDriver() {
    if (this.#parameters.localDriver) return this.#parameters.localDriver
    return new Memory({ maxSize: 100, ttl: this.#parameters.ttl, prefix: 'test' })
  }

  /**
   * Instantiate and return the remote driver
   */
  #createRemoteDriver() {
    if (this.#parameters.remoteDriver) return this.#parameters.remoteDriver

    // TODO: maybe try replace with memory remote driver
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
    this.#parameters.busDriver = this.#parameters.busDriver ?? new MemoryBus(createId())
    // this.#parameters.busDriver = new RedisBus(createId(), REDIS_CREDENTIALS)

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

    const cache = new Cache('primary', {
      localDriver: local,
      remoteDriver: remote,
      busDriver: this.#parameters.busDriver,
      emitter: this.#parameters.emitter || new EventEmitter(),
      ttl: this.#parameters.ttl,
      logger: this.#parameters.logger || noopLogger(),
      gracefulRetain: this.#parameters.gracefulRetain ?? { enabled: false },
      earlyExpiration: this.#parameters.earlyExpiration,
      timeouts: this.#parameters.timeouts,
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
