import { KyselyAdapter } from '../src/drivers/kysely.js'
import { DatabaseDriver } from '../src/drivers/database.js'
import type { CreateDriverResult, KyselyConfig } from '../src/types/main.js'

/**
 * Create a kysely driver
 * You will need to install the underlying database package (mysql2, pg, sqlite3, etc)
 */
export function kyselyDriver(options: KyselyConfig): CreateDriverResult<DatabaseDriver> {
  return {
    options,
    factory: (config: KyselyConfig) => {
      const adapter = new KyselyAdapter(config)
      return new DatabaseDriver(adapter, config)
    },
  }
}
