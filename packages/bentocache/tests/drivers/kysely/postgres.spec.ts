import pg from 'pg'
import { test } from '@japa/runner'
import { Kysely, PostgresDialect } from 'kysely'

import { createKyselyStore } from './helpers.js'
import { registerCacheDriverTestSuite } from '../../../src/test_suite.js'

test.group('Kysely | Postgres driver', (group) => {
  registerCacheDriverTestSuite({
    test,
    group,
    supportsMilliseconds: false,
    createDriver: (options) => {
      const db = new Kysely<any>({
        dialect: new PostgresDialect({
          pool: new pg.Pool({ user: 'postgres', password: 'postgres' }),
        }),
      })

      return createKyselyStore({ connection: db, prefix: 'japa', ...options })
    },
  })
})
