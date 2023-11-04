import { test } from '@japa/runner'

import { Postgres } from '../../src/drivers/sql/postgres.js'
import { registerCacheDriverTestSuite } from '../../test_helpers/driver_test_suite.js'

registerCacheDriverTestSuite({
  test,
  driver: Postgres,
  config: {
    prefix: 'japa',
    connection: { user: 'postgres', password: 'postgres' },
  },
})
