/*
 * @adonisjs/cache
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import app from '@adonisjs/core/services/app'
import type { CacheService } from '../src/types/main.js'

let cache: CacheService

/**
 * Returns a singleton instance of the cache manager from the
 * container
 */
await app.booted(async () => {
  cache = await app.container.make('cache')
})

export { cache as default }
