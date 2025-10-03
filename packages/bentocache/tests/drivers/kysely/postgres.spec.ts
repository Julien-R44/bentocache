import pg from 'pg'
import { test } from '@japa/runner'
import { Kysely, PostgresDialect } from 'kysely'

import { createKyselyStore } from './helpers.js'
import type { PostgresConnection } from '../orchid/postgres.spec.js'
import { DatabaseType, getDbConfig } from '../../helpers/db_config.js'
import { registerCacheDriverTestSuite } from '../../../src/test_suite.js'

test.group('Kysely | Postgres driver', (group) => {
  registerCacheDriverTestSuite({
    test,
    group,
    supportsMilliseconds: false,
    createDriver: (options) => {
      const config = getDbConfig(DatabaseType.POSTGRES)
      const connection = config.connection as PostgresConnection

      const db = new Kysely<any>({
        dialect: new PostgresDialect({
          pool: new pg.Pool({ user: connection.user, password: connection.password }),
        }),
      })

      return createKyselyStore({ connection: db, prefix: 'japa', ...options })
    },
  })
})
