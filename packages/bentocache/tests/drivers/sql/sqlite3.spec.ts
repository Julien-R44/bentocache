import { test } from '@japa/runner'

import { Sql } from '../../../src/drivers/sql.js'
import { registerCacheDriverTestSuite } from '../../../test_helpers/driver_test_suite.js'

test.group('Sqlite3 driver', (group) => {
  registerCacheDriverTestSuite({
    group,
    driver: Sql,
    supportsMilliseconds: true,
    config: {
      dialect: 'sqlite3',
      prefix: 'japa',
      connection: { filename: 'cache.sqlite3' },
    },
  })
})
