/*
 * @adonisjs/cache
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import type { ApplicationService } from '@adonisjs/core/types'

import driversList from '../src/drivers_list.js'
import type { CacheDriversList } from '../src/types/main.js'

export default class CacheProvider {
  constructor(protected app: ApplicationService) {}

  /**
   * Define repl bindings
   */
  protected async defineReplBindings() {
    if (this.app.getEnvironment() !== 'repl') {
      return
    }

    const { defineReplBindings } = await import('../src/bindings/repl.js')
    defineReplBindings(this.app, await this.app.container.make('repl'))
  }

  /**
   * Register built-in stores in the driversList
   */
  async #registerDrivers(driversInUse: Set<keyof CacheDriversList>) {
    if (driversInUse.has('memory')) {
      const { Memory } = await import('../src/drivers/memory.js')
      driversList.extend('memory', (c) => new Memory(c))
    }

    if (driversInUse.has('file')) {
      const { File } = await import('../src/drivers/file.js')
      driversList.extend('file', (c) => new File(c))
    }

    if (driversInUse.has('redis')) {
      const { Redis } = await import('../src/drivers/redis.js')
      driversList.extend('redis', (c) => new Redis(c))
    }

    if (driversInUse.has('dynamodb')) {
      const { DynamoDB } = await import('../src/drivers/dynamodb.js')
      driversList.extend('dynamodb', (c) => new DynamoDB(c))
    }

    if (driversInUse.has('cloudflarekv')) {
      const { CloudflareKv } = await import('../src/drivers/cloudflare_kv.js')
      driversList.extend('cloudflarekv', (c) => new CloudflareKv(c))
    }
  }

  /**
   * Register cache manager singleton
   */
  registerCacheManager() {
    this.app.container.singleton('cache', async () => {
      const { CacheManager } = await import('../src/cache_manager.js')

      const config = this.app.config.get<any>('cache', {})
      const emitter = await this.app.container.make('emitter')

      return new CacheManager(config, emitter)
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
    this.app.container.resolving('cache', async () => {
      const config = this.app.config.get<any>('cache')
      await this.#registerDrivers(config.driversInUse)
    })

    await this.defineReplBindings()
  }

  /**
   * Disconnect all drivers when shutting down the app
   */
  async shutdown() {
    const cache = await this.app.container.make('cache')
    await cache.disconnectAll()
  }
}
