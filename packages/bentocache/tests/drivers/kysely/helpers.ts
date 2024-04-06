import type { KyselyConfig } from '../../../src/types/main.js'
import { DatabaseDriver } from '../../../src/drivers/database/database.js'
import { KyselyAdapter } from '../../../src/drivers/database/adapters/kysely.js'

export function createKyselyStore(options: KyselyConfig) {
  const adapter = new KyselyAdapter(options)
  return new DatabaseDriver(adapter, options)
}
