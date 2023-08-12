/*
 * @quakjs/bentocache
 *
 * (c) Quak
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { BaseSql } from './base_sql.js'
import type { SqlConfig } from '../../types/main.js'
import type { CacheDriver } from '../../types/driver.js'

/**
 * Postgres driver
 */
export class Postgres extends BaseSql implements CacheDriver {
  constructor(config: SqlConfig) {
    super({ ...config, dialect: 'pg' })
  }
}
