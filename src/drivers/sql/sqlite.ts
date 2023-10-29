import { BaseSql } from './base_sql.js'
import type { SqlConfig } from '../../types/main.js'
import type { CacheDriver } from '../../types/driver.js'

/**
 * SQLite driver
 */
export class Sqlite extends BaseSql implements CacheDriver {
  constructor(config: SqlConfig) {
    super({ ...config, dialect: 'better-sqlite3' })
  }
}
