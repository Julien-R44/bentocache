import type { DrizzleConfig } from '../../../src/types/main.js'
import { DatabaseDriver } from '../../../src/drivers/database/database.js'
import { DrizzleAdapter } from '../../../src/drivers/database/adapters/drizzle.js'

export function createDrizzleStore(options: DrizzleConfig) {
  const adapter = new DrizzleAdapter(options)
  return new DatabaseDriver(adapter, options)
}
