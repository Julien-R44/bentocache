/*
 * @adonisjs/cache
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { defu } from 'defu'
import { EventEmitter } from 'node:events'
import { getActiveTest } from '@japa/runner'

import { Redis } from '../src/drivers/redis.js'
import { Cache } from '../src/providers/cache.js'
import { Memory } from '../src/drivers/memory.js'
import type { CacheDriver } from '../src/types/main.js'
import type { Emitter, GracefulRetainOptions } from '../src/types/main.js'

type FactoryParameters = {
  emitter: Emitter
  ttl: number
  gracefulRetain: GracefulRetainOptions
  earlyExpiration: number
}

export class CacheFactory {
  #localDriver: CacheDriver
  #remoteDriver: CacheDriver
  #parameters: Partial<FactoryParameters> = {
    gracefulRetain: { enabled: false },
  }

  #getDriver() {
    if (this.#localDriver) {
      return this.#localDriver
    }

    return new Memory({ maxSize: 100, ttl: this.#parameters.ttl, prefix: 'test' })
  }

  #getEmitter() {
    return this.#parameters.emitter ?? new EventEmitter()
  }

  merge(parameters: Partial<FactoryParameters>) {
    this.#parameters = defu(parameters, this.#parameters)
    return this
  }

  withHybridConfig(remoteDriver?: CacheDriver) {
    this.#localDriver =
      this.#localDriver ??
      new Memory({
        maxSize: 100,
        ttl: this.#parameters.ttl,
        prefix: 'test',
      })

    this.#remoteDriver =
      remoteDriver ??
      new Redis({
        connection: { host: '127.0.0.1', port: 6379 },
        prefix: 'test',
      })

    return this
  }

  create(autoCleanup = true) {
    const driver = this.#getDriver()
    const remoteDriver = this.#remoteDriver!

    const cache = new Cache('primary', {
      localDriver: driver,
      remoteDriver: this.#remoteDriver,
      emitter: this.#getEmitter(),
      ttl: this.#parameters.ttl,
      gracefulRetain: this.#parameters.gracefulRetain,
      earlyExpiration: this.#parameters.earlyExpiration,
    })

    async function teardown() {
      await cache.clear()
      await cache.disconnect()
    }

    if (autoCleanup) getActiveTest()?.cleanup(teardown)

    return {
      cache,
      driver,
      local: driver,
      remote: remoteDriver,
      teardown,
    }
  }
}
