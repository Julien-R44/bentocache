import { KnexAdapter } from '../../../src/drivers/knex.js'
import type { KnexConfig } from '../../../src/types/main.js'
import { DatabaseDriver } from '../../../src/drivers/database.js'

export function createKnexStore(options: KnexConfig) {
  const adapter = new KnexAdapter(options)
  return new DatabaseDriver(adapter, options)
}
