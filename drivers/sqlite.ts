import { Sqlite } from '../src/drivers/sql/sqlite.js'
import type { SqlConfig } from '../src/types/options/drivers_options.js'
import type { CacheDriverOptions, CreateDriverResult } from '../src/types/main.js'

/**
 * Create a new sqlite driver
 */
export function sqliteDriver(options: SqlConfig & CacheDriverOptions): CreateDriverResult<Sqlite> {
  return {
    options,
    factory: (config: SqlConfig) => new Sqlite(config),
  }
}
