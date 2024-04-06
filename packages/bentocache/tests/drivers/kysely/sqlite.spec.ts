import { test } from '@japa/runner'
import * as SQLite from 'better-sqlite3'
import { Kysely, SqliteDialect } from 'kysely'

import { createKyselyStore } from './helpers.js'
import { registerCacheDriverTestSuite } from '../../../src/test_suite.js'

test.group('Kysely | Postgres driver', (group) => {
  registerCacheDriverTestSuite({
    test,
    group,
    supportsMilliseconds: false,
    createDriver: (options) => {
      const db = new Kysely<any>({
        dialect: new SqliteDialect({
          database: new SQLite.default('./cache.sqlite3'),
        }),
      })

      return createKyselyStore({ connection: db, prefix: 'japa', ...options })
    },
  })
})
