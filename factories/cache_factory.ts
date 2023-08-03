/*
 * @adonisjs/cache
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { EventEmitter } from 'node:events'

import { Cache } from '../src/cache.js'
import { Redis } from '../src/drivers/redis.js'
import type { Emitter } from '../src/types/main.js'
import type { CacheDriver } from '../src/types/main.js'

type FactoryParameters = {
  emitter: Emitter
  driver: CacheDriver
  ttl: number
}

export class CacheFactory {
  #parameters: Partial<FactoryParameters> = {}

  merge(parameters: Partial<FactoryParameters>) {
    Object.assign(this.#parameters, parameters)
    return this
  }

  #getDriver() {
    return (
      this.#parameters.driver ??
      new Redis({
        ttl: this.#parameters.ttl ?? 1000 * 60 * 60,
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
      ttl: this.#parameters.ttl ?? 1000 * 60 * 60,
    })
  }
}
