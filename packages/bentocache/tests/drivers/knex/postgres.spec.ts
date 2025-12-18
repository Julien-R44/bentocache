import knex from 'knex'
import { test } from '@japa/runner'

import { createKnexStore } from './helpers.js'
import { POSTGRES_CREDENTIALS } from '../../helpers/index.js'
import { registerCacheDriverTestSuite } from '../../helpers/driver_test_suite.js'

test.group('Knex | Postgres driver', (group) => {
  registerCacheDriverTestSuite({
    test,
    group,
    supportsMilliseconds: false,
    createDriver: (options) => {
      const db = knex({
        client: 'pg',
        connection: { ...POSTGRES_CREDENTIALS },
      })

      return createKnexStore({ connection: db, prefix: 'japa', ...options })
    },
  })
})
