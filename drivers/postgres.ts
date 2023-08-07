import { Postgres } from '../src/drivers/sql/postgres.js'
import type { CreateDriverResult, SqlConfig } from '../src/types/main.js'

/**
 * Create a new postgres driver
 */
export function postgresDriver(options: SqlConfig): CreateDriverResult {
  return { local: { options, factory: (config: SqlConfig) => new Postgres(config) } }
}
