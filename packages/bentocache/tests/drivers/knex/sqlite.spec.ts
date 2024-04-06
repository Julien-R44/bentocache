import knex from 'knex'
import { test } from '@japa/runner'

import { createKnexStore } from './helpers.js'
import { registerCacheDriverTestSuite } from '../../../test_helpers/driver_test_suite.js'

const db = knex({
  client: 'better-sqlite3',
  connection: { filename: ':memory:' },
  useNullAsDefault: true,
})

test.group('Knex | Better-sqlite3 driver', (group) => {
  registerCacheDriverTestSuite({
    test,
    group,
    createStore: (options) => createKnexStore({ connection: db, prefix: 'japa', ...options }),
  })
})
