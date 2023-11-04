import { test } from '@japa/runner'

import { Sqlite } from '../../src/drivers/sql/sqlite.js'
import { registerCacheDriverTestSuite } from '../../test_helpers/driver_test_suite.js'

registerCacheDriverTestSuite({
  test,
  driver: Sqlite,
  supportsMilliseconds: true,
  config: {
    prefix: 'japa',
    connection: {
      filename: 'cache.sqlite3',
    },
  },
})
