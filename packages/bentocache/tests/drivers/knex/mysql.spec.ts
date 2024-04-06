import knex from 'knex'
import { test } from '@japa/runner'

import { createKnexStore } from './helpers.js'
import { registerCacheDriverTestSuite } from '../../../test_helpers/driver_test_suite.js'

const db = knex({
  client: 'mysql2',
  connection: { user: 'root', password: 'root', database: 'mysql', port: 3306 },
})

test.group('Knex | MySQL driver', (group) => {
  registerCacheDriverTestSuite({
    test,
    group,
    supportsMilliseconds: false,
    createDriver: (options) => createKnexStore({ connection: db, prefix: 'japa', ...options }),
  })
})
