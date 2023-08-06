import { test } from '@japa/runner'
import { registerApiTestSuite } from '../../test_helpers/driver_test_suite.js'
import { Sqlite } from '../../src/drivers/sql/sqlite.js'

registerApiTestSuite({
  test,
  driver: Sqlite,
  supportsMilliseconds: true,
  config: {
    ttl: 30 * 100,
    prefix: 'japa',
    connection: {
      filename: 'cache.sqlite3',
    },
  },
})
