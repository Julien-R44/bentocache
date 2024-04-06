import pg from 'pg'
import { test } from '@japa/runner'
import { Kysely, PostgresDialect } from 'kysely'

import { createKyselyStore } from './helpers.js'
import { registerCacheDriverTestSuite } from '../../../src/test_suite.js'

const db = new Kysely<any>({
  dialect: new PostgresDialect({ pool: new pg.Pool({ user: 'postgres', password: 'postgres' }) }),
})

test.group('Kysely | Postgres driver', (group) => {
  registerCacheDriverTestSuite({
    test,
    group,
    supportsMilliseconds: false,
    createDriver: (options) => createKyselyStore({ connection: db, prefix: 'japa', ...options }),
  })
})
