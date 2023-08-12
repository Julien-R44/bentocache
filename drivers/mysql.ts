/*
 * @quakjs/bentocache
 *
 * (c) Quak
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { Mysql } from '../src/drivers/sql/mysql.js'
import type { CreateDriverResult, SqlConfig } from '../src/types/main.js'

/**
 * Create a new MySQL driver
 */
export function mysqlDriver(options: SqlConfig): CreateDriverResult {
  return { local: { options, factory: (config: SqlConfig) => new Mysql(config) } }
}
