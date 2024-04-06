import { bentostore } from '../src/bento_store.js'
import { BentoCache } from '../src/bento_cache.js'
import { memoryDriver } from '../src/drivers/memory.js'
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
        primary: bentostore().useL1Layer(memoryDriver({ maxItems: 100 })),
        secondary: bentostore().useL1Layer(memoryDriver({ maxItems: 100 })),
      },
      ...this.#parameters,
    })

    return { bento }
  }
}
