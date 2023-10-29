import { Mysql } from '../src/drivers/sql/mysql.js'
import type { CreateDriverResult, SqlConfig } from '../src/types/main.js'

/**
 * Create a new MySQL driver
 */
export function mysqlDriver(options: SqlConfig): CreateDriverResult {
  return {
    l1: { options, factory: (config: SqlConfig) => new Mysql(config) },
  }
}
