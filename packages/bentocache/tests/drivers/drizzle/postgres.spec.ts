import pg from 'pg'
import { test } from '@japa/runner'
import { drizzle } from 'drizzle-orm/node-postgres'

import { createDrizzleStore } from './helpers.js'
import { registerCacheDriverTestSuite } from '../../../src/test_suite.js'

test.group('Drizzle | Postgres driver', (group) => {
  registerCacheDriverTestSuite({
    test,
    group,
    supportsMilliseconds: false,
    createDriver: (options) => {
      const pool = new pg.Pool({
        host: 'localhost',
        port: 5432,
        database: 'postgres',
        user: 'postgres',
        password: 'postgres',
      })
      const db = drizzle({ client: pool })

      return createDrizzleStore({ connection: db, dialect: 'pg', prefix: 'japa', ...options })
    },
  })
})
