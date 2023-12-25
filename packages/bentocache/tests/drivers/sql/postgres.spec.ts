import { test } from '@japa/runner'

import { Sql } from '../../../src/drivers/sql.js'
import { registerCacheDriverTestSuite } from '../../../test_helpers/driver_test_suite.js'

registerCacheDriverTestSuite({
  name: 'postgres',
  test,
  driver: Sql,
  config: {
    dialect: 'pg',
    prefix: 'japa',
    connection: { user: 'postgres', password: 'postgres' },
  },
})
