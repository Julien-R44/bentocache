import { ApplicationService } from '@adonisjs/core/types'
import driversList from '../src/drivers_list.js'
import { File } from '../src/drivers/file.js'
import { Memory } from '../src/drivers/memory.js'
import { Memcache } from '../src/drivers/memcache.js'
import { Redis } from '../src/drivers/redis.js'

export default class CacheProvider {
  constructor(protected app: ApplicationService) {}

  /**
   * Register built-in stores in the driversList
   */
  async #registerDrivers() {
    driversList.extend('file', (c) => new File(c))
    driversList.extend('redis', (c) => new Redis(c))
    driversList.extend('memory', (c) => new Memory(c))
    driversList.extend('memcache', (c) => new Memcache(c))
  }

  /**
   * Register cache manager singleton
   */
  registerCacheManager() {
    this.app.container.singleton('cache', async () => {
      const { CacheManager } = await import('../src/cache_manager.js')
      const config = this.app.config.get<any>('cache', {})

      return new CacheManager(config)
    })
  }

  /**
   * Registers bindings
   */
  async register() {
    this.registerCacheManager()
  }

  /**
   * Register drivers
   */
  async boot() {
    await this.#registerDrivers()
  }

  /**
   * Disconnect all drivers when shutting down the app
   */
  async shutdown() {
    const cache = await this.app.container.make('cache')
    await cache.disconnectAll()
  }
}
