/*
 * @adonisjs/cache
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { EventEmitter } from 'node:events'
import { defu } from 'defu'

import { Cache } from '../src/providers/cache.js'
import { Redis } from '../src/drivers/redis.js'
import type { Emitter, GracefulRetainOptions } from '../src/types/main.js'
import type { CacheDriver } from '../src/types/main.js'

type FactoryParameters = {
  emitter: Emitter
  driver: CacheDriver
  ttl: number
  gracefulRetain: GracefulRetainOptions
}

export class CacheFactory {
  #parameters: Partial<FactoryParameters> = {
    gracefulRetain: { enabled: false },
  }

  merge(parameters: Partial<FactoryParameters>) {
    this.#parameters = defu(parameters, this.#parameters)
    return this
  }

  #getDriver() {
    return (
      this.#parameters.driver ??
      new Redis({
        ttl: this.#parameters.ttl,
        prefix: 'test',
        connection: { host: '127.0.0.1', port: 6379 },
      })
    )
  }

  #getEmitter() {
    return this.#parameters.emitter ?? new EventEmitter()
  }

  create() {
    return new Cache('primary', this.#getDriver(), {
      emitter: this.#getEmitter(),
      ttl: this.#parameters.ttl,
      gracefulRetain: this.#parameters.gracefulRetain,
    })
  }

  createWithTeardown() {
    const cache = this.create()
    return {
      cache,
      async teardown() {
        await cache.clear()
        await cache.disconnect()
      },
    }
  }
}
