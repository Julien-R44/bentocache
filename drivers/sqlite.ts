/*
 * @blizzle/bentocache
 *
 * (c) Blizzle
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { Sqlite } from '../src/drivers/sql/sqlite.js'
import type { SqlConfig } from '../src/types/options/drivers_options.js'
import type { CacheDriverOptions, CreateDriverResult } from '../src/types/main.js'

/**
 * Create a new sqlite driver
 */
export function sqliteDriver(options: SqlConfig & CacheDriverOptions): CreateDriverResult {
  return {
    l1: { options, factory: (config: SqlConfig) => new Sqlite(config) },
  }
}
