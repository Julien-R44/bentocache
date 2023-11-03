import { Mysql } from '../src/drivers/sql/mysql.js'
import type { CreateDriverResult, SqlConfig } from '../src/types/main.js'

/**
 * Create a new MySQL driver
 */
export function mysqlDriver(options: SqlConfig): CreateDriverResult<Mysql> {
  return {
    options,
    factory: (config: SqlConfig) => new Mysql(config),
  }
}
