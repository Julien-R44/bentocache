/*
 * @adonisjs/cache
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import type { CacheService } from './main.js'

declare module '@adonisjs/core/types' {
  export interface ContainerBindings {
    cache: CacheService
  }
}
