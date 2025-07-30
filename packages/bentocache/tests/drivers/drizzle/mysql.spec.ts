import mysql from 'mysql2/promise'
import { test } from '@japa/runner'
import { drizzle } from 'drizzle-orm/mysql2'

import { createDrizzleStore } from './helpers.js'
import { registerCacheDriverTestSuite } from '../../../src/test_suite.js'

test.group('Drizzle | MySQL driver', (group) => {
  registerCacheDriverTestSuite({
    test,
    group,
    supportsMilliseconds: true,
    createDriver: (options) => {
      const db = drizzle({
        client: mysql.createPool({
          host: 'localhost',
          port: 3306,
          database: 'mysql',
          user: 'root',
          password: 'root',
        }),
      })

      return createDrizzleStore({ connection: db, dialect: 'mysql', prefix: 'japa', ...options })
    },
  })
})
