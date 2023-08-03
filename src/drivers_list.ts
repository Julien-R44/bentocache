/*
 * @adonisjs/cache
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { RuntimeException } from '@poppinss/utils'
import type { CacheDriversList } from './types/main.js'

/**
 * A global collection of Cache drivers
 */
class CacheDriversCollection {
  /**
   * List of registered drivers
   */
  list: Partial<CacheDriversList> = {}

  /**
   * Extend drivers collection and add a custom
   * driver to it.
   */
  extend<Name extends keyof CacheDriversList>(
    driverName: Name,
    factoryCallback: CacheDriversList[Name]
  ): this {
    this.list[driverName] = factoryCallback
    return this
  }

  /**
   * Creates the driver instance with config
   */
  create<Name extends keyof CacheDriversList>(
    name: Name,
    config: Parameters<CacheDriversList[Name]>[number]
  ) {
    const driverFactory = this.list[name]
    if (!driverFactory) {
      throw new RuntimeException(
        `Unknown cache driver "${String(name)}". Make sure the driver is registered`
      )
    }

    return driverFactory(config as any)
  }
}

const driversList = new CacheDriversCollection()
export default driversList
