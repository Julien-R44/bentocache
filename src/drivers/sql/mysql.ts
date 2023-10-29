import { BaseSql } from './base_sql.js'
import type { CacheDriver } from '../../types/driver.js'
import type { SqlConfig } from '../../types/options/drivers_options.js'

/**
 * MySQL driver
 */
export class Mysql extends BaseSql implements CacheDriver {
  constructor(config: SqlConfig) {
    super({ ...config, dialect: 'mysql2' })
  }
}
