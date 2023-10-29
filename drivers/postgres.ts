import { Postgres } from '../src/drivers/sql/postgres.js'
import type { CreateDriverResult, SqlConfig } from '../src/types/main.js'

/**
 * Create a new Postgres driver
 */
export function postgresDriver(options: SqlConfig): CreateDriverResult {
  return {
    l1: { options, factory: (config: SqlConfig) => new Postgres(config) },
  }
}
