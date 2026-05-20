import { test } from '@japa/runner'

import { registerCacheDriverTestSuite } from '../helpers/driver_test_suite.js'

if (typeof (globalThis as any).Bun !== 'undefined') {
  const { BunSqliteAdapter } = await import('../../src/drivers/database/adapters/bun_sqlite.js')
  const { DatabaseDriver } = await import('../../src/drivers/database/database.js')

  test.group('Bun SQLite driver', (group) => {
    registerCacheDriverTestSuite({
      test,
      group,
      supportsMilliseconds: false,
      createDriver: (options) => {
        const config = {
          connection: './bun-cache.sqlite3',
          prefix: 'japa',
          pruneInterval: false as const,
          ...options,
        }
        const adapter = new BunSqliteAdapter(config)
        return new DatabaseDriver(adapter, config)
      },
    })
  })
}
