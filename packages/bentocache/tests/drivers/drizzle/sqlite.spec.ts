import { test } from '@japa/runner'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'

import { createDrizzleStore } from './helpers.js'
import { registerCacheDriverTestSuite } from '../../../src/test_suite.js'

test.group('Drizzle | SQLite driver', (group) => {
  registerCacheDriverTestSuite({
    test,
    group,
    supportsMilliseconds: false,
    createDriver: (options) => {
      const db = drizzle({
        client: new Database('./cache.db'),
      })

      return createDrizzleStore({
        connection: db,
        dialect: 'sqlite',
        prefix: 'japa',
        tableName: 'bentocache',
        ...options,
      })
    },
  })
})
