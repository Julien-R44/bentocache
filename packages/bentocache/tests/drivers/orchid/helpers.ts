import type { OrchidConfig } from '../../../src/types/main.js'
import { DatabaseDriver } from '../../../src/drivers/database/database.js'
import { OrchidAdapter } from '../../../src/drivers/database/adapters/orchid.js'

export function createOrchidStore(options: OrchidConfig) {
  const adapter = new OrchidAdapter(options)
  return new DatabaseDriver(adapter, options)
}
