/*
 * @quakjs/bentocache
 *
 * (c) Quak
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { Postgres } from '../src/drivers/sql/postgres.js'
import type { CreateDriverResult, SqlConfig } from '../src/types/main.js'

/**
 * Create a new postgres driver
 */
export function postgresDriver(options: SqlConfig): CreateDriverResult {
  return { local: { options, factory: (config: SqlConfig) => new Postgres(config) } }
}
