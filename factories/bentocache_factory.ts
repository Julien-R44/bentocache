/*
 * @quakjs/bentocache
 *
 * (c) Quak
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { BentoCache } from '../src/bento_cache.js'
import { memoryDriver } from '../drivers/memory.js'
import type { RawBentoCacheOptions } from '../src/types/main.js'

/**
 * A factory that creates a new BentoCache instance
 * Handy for quickly creating a new instance in a test
 */
export class BentoCacheFactory {
  #parameters: RawBentoCacheOptions = {}

  /**
   * Assign custom parameters to the final instance
   */
  merge(parameters: RawBentoCacheOptions) {
    Object.assign(this.#parameters, parameters)
    return this
  }

  /**
   * Create a new instance of BentoCache
   */
  create() {
    const bento = new BentoCache({
      default: 'primary',
      ttl: '30s',
      stores: {
        primary: { driver: memoryDriver({ maxSize: 100 }) },
        secondary: { driver: memoryDriver({ maxSize: 100 }) },
      },
      ...this.#parameters,
    })

    return { bento }
  }
}
