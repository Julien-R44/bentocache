import { BentoCache } from '../src/bento_cache.js'
import { memoryDriver } from '../src/drivers/memory.js'

export class BentoCacheFactory {
  create() {
    const bento = new BentoCache({
      default: 'primary',
      stores: {
        primary: memoryDriver({
          maxSize: 100,
          ttl: 30_000,
        }),

        secondary: memoryDriver({
          maxSize: 100,
          ttl: 30_000,
        }),
      },
    })

    return { bento }
  }
}
