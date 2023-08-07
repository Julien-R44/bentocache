import { Sqlite } from '../src/drivers/sql/sqlite.js'
import type { SqlConfig } from '../src/types/options.js'
import type { CreateDriverResult } from '../src/types/main.js'

/**
 * Create a new sqlite driver
 */
export function sqliteDriver(options: SqlConfig): CreateDriverResult {
  return { local: { options, factory: (config: SqlConfig) => new Sqlite(config) } }
}
