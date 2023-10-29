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
