/*
 * @quakjs/bentocache
 *
 * (c) Quak
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { Sqlite } from '../src/drivers/sql/sqlite.js'
import type { SqlConfig } from '../src/types/options.js'
import type { CreateDriverResult } from '../src/types/main.js'

/**
 * Create a new sqlite driver
 */
export function sqliteDriver(options: SqlConfig): CreateDriverResult {
  return { local: { options, factory: (config: SqlConfig) => new Sqlite(config) } }
}
