import type { Logger } from '../src/types/main.js'
import { BentoCache } from '../src/bento_cache.js'
import { memoryDriver } from '../drivers/memory.js'

type FactoryParameters = {
  logger?: Logger
}

/**
 * A factory that creates a new BentoCache instance
 * Handy for quickly creating a new instance in a test
 */
export class BentoCacheFactory {
  #parameters: FactoryParameters = {}

  /**
   * Assign custom parameters to the final instance
   */
  merge(parameters: FactoryParameters) {
    Object.assign(this.#parameters, parameters)
    return this
  }

  /**
   * Create a new instance of BentoCache
   */
  create() {
    const bento = new BentoCache({
      default: 'primary',
      stores: {
        primary: memoryDriver({ maxSize: 100, ttl: 30_000 }),
        secondary: memoryDriver({ maxSize: 100, ttl: 30_000 }),
      },
      logger: this.#parameters.logger,
    })

    return { bento }
  }
}
