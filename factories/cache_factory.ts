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
import { Memory } from '../src/drivers/memory.js'
import type { CacheDriver } from '../src/types/main.js'
import type { Emitter, GracefulRetainOptions } from '../src/types/main.js'

type FactoryParameters = {
  emitter: Emitter
  driver: CacheDriver
  ttl: number
  gracefulRetain: GracefulRetainOptions
  earlyExpiration: number
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
    if (this.#parameters.driver) {
      return this.#parameters.driver
    }

    return new Memory({ maxSize: 100, ttl: this.#parameters.ttl, prefix: 'test' })
  }

  #getEmitter() {
    return this.#parameters.emitter ?? new EventEmitter()
  }

  create() {
    const driver = this.#getDriver()

    const cache = new Cache('primary', driver, {
      emitter: this.#getEmitter(),
      ttl: this.#parameters.ttl,
      gracefulRetain: this.#parameters.gracefulRetain,
      earlyExpiration: this.#parameters.earlyExpiration,
    })

    return {
      cache,
      driver,
      async teardown() {
        await cache.clear()
        await cache.disconnect()
      },
    }
  }
}
