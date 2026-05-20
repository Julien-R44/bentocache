import { test } from '@japa/runner'

import { POSTGRES_CREDENTIALS } from '../helpers/index.js'
import { registerCacheDriverTestSuite } from '../helpers/driver_test_suite.js'

if (typeof (globalThis as any).Bun !== 'undefined') {
  const { BunPostgresAdapter } = await import('../../src/drivers/database/adapters/bun_postgres.js')
  const { DatabaseDriver } = await import('../../src/drivers/database/database.js')

  const port = process.env.BUN_POSTGRES_PORT || '5432'
  const connectionUrl = `postgres://${POSTGRES_CREDENTIALS.user}:${POSTGRES_CREDENTIALS.password}@localhost:${port}/postgres`

  test.group('Bun Postgres driver', (group) => {
    registerCacheDriverTestSuite({
      test,
      group,
      createDriver: (options) => {
        const config = {
          connection: connectionUrl,
          prefix: 'japa',
          pruneInterval: false as const,
          ...options,
        }
        const adapter = new BunPostgresAdapter(config)
        return new DatabaseDriver(adapter, config)
      },
    })
  })
}
