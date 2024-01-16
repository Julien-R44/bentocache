import { test } from '@japa/runner'

import { Sql } from '../../../src/drivers/sql.js'
import { registerCacheDriverTestSuite } from '../../../test_helpers/driver_test_suite.js'

test.group('Mysql driver', (group) => {
  registerCacheDriverTestSuite({
    group,
    driver: Sql,
    supportsMilliseconds: false,
    config: {
      dialect: 'mysql2',
      prefix: 'japa',
      connection: { user: 'root', password: 'root', database: 'mysql', port: 3306 },
    },
  })
})
