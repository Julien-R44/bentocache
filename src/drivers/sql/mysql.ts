import type { CacheDriver } from '../../types/driver.js'
import type { SqlConfig } from '../../types/options.js'
import { BaseSql } from './base_sql.js'

export class Mysql extends BaseSql implements CacheDriver {
  constructor(config: SqlConfig) {
    super({ ...config, dialect: 'mysql2' })
  }
}
