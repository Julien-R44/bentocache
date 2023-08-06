import type { CacheDriver } from '../types/driver.js'
import type { SqlConfig } from '../types/main.js'
import { BaseSql } from './base_sql.js'

export class Sqlite extends BaseSql implements CacheDriver {
  constructor(config: SqlConfig) {
    super({ ...config, dialect: 'better-sqlite3' })
  }
}
