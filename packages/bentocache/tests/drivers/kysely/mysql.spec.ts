import { test } from '@japa/runner'
import { createPool } from 'mysql2'
import { Kysely, MysqlDialect } from 'kysely'

import { createKyselyStore } from './helpers.js'
import { registerCacheDriverTestSuite } from '../../../src/test_suite.js'

test.group('Kysely | Mysql driver', (group) => {
  registerCacheDriverTestSuite({
    test,
    group,
    supportsMilliseconds: false,
    createDriver: (options) => {
      const db = new Kysely<any>({
        dialect: new MysqlDialect({
          pool: createPool({ user: 'root', password: 'root', database: 'mysql', port: 3306 }),
        }),
      })

      return createKyselyStore({ connection: db, prefix: 'japa', ...options })
    },
  })
})
