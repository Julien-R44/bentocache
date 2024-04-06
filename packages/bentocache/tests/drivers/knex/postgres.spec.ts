import knex from 'knex'
import { test } from '@japa/runner'

import { createKnexStore } from './helpers.js'
import { registerCacheDriverTestSuite } from '../../../test_helpers/driver_test_suite.js'

const db = knex({
  client: 'pg',
  connection: { user: 'postgres', password: 'postgres' },
})

test.group('Knex | MySQL driver', (group) => {
  registerCacheDriverTestSuite({
    test,
    group,
    supportsMilliseconds: false,
    createStore: (options) => createKnexStore({ connection: db, prefix: 'japa', ...options }),
  })
})
