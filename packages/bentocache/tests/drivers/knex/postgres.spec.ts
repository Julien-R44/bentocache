import knex from 'knex'
import { test } from '@japa/runner'

import { createKnexStore } from './helpers.js'
import { registerCacheDriverTestSuite } from '../../../test_helpers/driver_test_suite.js'

test.group('Knex | MySQL driver', (group) => {
  registerCacheDriverTestSuite({
    test,
    group,
    supportsMilliseconds: false,
    createDriver: (options) => {
      const db = knex({
        client: 'pg',
        connection: { user: 'postgres', password: 'postgres' },
      })

      return createKnexStore({ connection: db, prefix: 'japa', ...options })
    },
  })
})
