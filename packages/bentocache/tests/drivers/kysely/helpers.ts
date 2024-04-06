import type { KyselyConfig } from '../../../src/types/main.js'
import { KyselyAdapter } from '../../../src/drivers/kysely.js'
import { DatabaseDriver } from '../../../src/drivers/database.js'

export function createKyselyStore(options: KyselyConfig) {
  const adapter = new KyselyAdapter(options)
  return new DatabaseDriver(adapter, options)
}
