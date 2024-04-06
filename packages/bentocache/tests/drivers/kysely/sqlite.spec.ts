import { test } from '@japa/runner'
import * as SQLite from 'better-sqlite3'
import { Kysely, SqliteDialect } from 'kysely'

import { createKyselyStore } from './helpers.js'
import { registerCacheDriverTestSuite } from '../../../src/test_suite.js'

const db = new Kysely<any>({
  dialect: new SqliteDialect({
    database: new SQLite.default('./cache.sqlite3'),
  }),
})

test.group('Kysely | Postgres driver', (group) => {
  registerCacheDriverTestSuite({
    test,
    group,
    supportsMilliseconds: false,
    createStore: (options) => createKyselyStore({ connection: db, prefix: 'japa', ...options }),
  })
})
