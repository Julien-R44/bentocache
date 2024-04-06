import { test } from '@japa/runner'
import { createPool } from 'mysql2'
import { Kysely, MysqlDialect } from 'kysely'

import { createKyselyStore } from './helpers.js'
import { registerCacheDriverTestSuite } from '../../../src/test_suite.js'

const db = new Kysely<any>({
  dialect: new MysqlDialect({
    pool: createPool({ user: 'root', password: 'root', database: 'mysql', port: 3306 }),
  }),
})

test.group('Kysely | Mysql driver', (group) => {
  registerCacheDriverTestSuite({
    test,
    group,
    supportsMilliseconds: false,
    createStore: (options) => createKyselyStore({ connection: db, prefix: 'japa', ...options }),
  })
})