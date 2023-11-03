import { Postgres } from '../src/drivers/sql/postgres.js'
import type { CreateDriverResult, SqlConfig } from '../src/types/main.js'

/**
 * Create a new Postgres driver
 */
export function postgresDriver(options: SqlConfig): CreateDriverResult<Postgres> {
  return {
    options,
    factory: (config: SqlConfig) => new Postgres(config),
  }
}
