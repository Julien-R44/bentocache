import knex from 'knex'
import { test } from '@japa/runner'

import { createKnexStore } from './helpers.js'
import { DatabaseType, getDbConfig } from '../../helpers/db_config.js'
import { registerCacheDriverTestSuite } from '../../helpers/driver_test_suite.js'

test.group('Knex | Postgres driver', (group) => {
  registerCacheDriverTestSuite({
    test,
    group,
    supportsMilliseconds: false,
    createDriver: (options) => {
      const db = knex(getDbConfig(DatabaseType.POSTGRES))
      return createKnexStore({ connection: db, prefix: 'japa', ...options })
    },
  })
})
