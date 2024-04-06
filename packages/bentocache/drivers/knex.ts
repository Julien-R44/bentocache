import { KnexAdapter } from '../src/drivers/knex.js'
import { DatabaseDriver } from '../src/drivers/database.js'
import type { CreateDriverResult, KnexConfig } from '../src/types/main.js'

/**
 * Create a knex driver
 * You will need to install the underlying database package (mysql2, pg, sqlite3, etc)
 */
export function knexDriver(options: KnexConfig): CreateDriverResult<DatabaseDriver> {
  return {
    options,
    factory: (config: KnexConfig) => {
      const adapter = new KnexAdapter(config)
      return new DatabaseDriver(adapter, config)
    },
  }
}
