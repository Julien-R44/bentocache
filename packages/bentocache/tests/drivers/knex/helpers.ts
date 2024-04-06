import type { KnexConfig } from '../../../src/types/main.js'
import { DatabaseDriver } from '../../../src/drivers/database/database.js'
import { KnexAdapter } from '../../../src/drivers/database/adapters/knex.js'

export function createKnexStore(options: KnexConfig) {
  const adapter = new KnexAdapter(options)
  return new DatabaseDriver(adapter, options)
}
