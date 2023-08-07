import { CacheManager } from '../src/cache_manager.js'
import { memoryDriver } from '../src/drivers/memory.js'

export class BentoCacheFactory {
  create() {
    const bento = new CacheManager({
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
