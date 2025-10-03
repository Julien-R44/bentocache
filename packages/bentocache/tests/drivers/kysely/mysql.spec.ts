import { test } from '@japa/runner'
import { createPool } from 'mysql2'
import { Kysely, MysqlDialect } from 'kysely'

import { createKyselyStore } from './helpers.js'
import { DatabaseType, getDbConfig } from '../../helpers/db_config.js'
import { registerCacheDriverTestSuite } from '../../../src/test_suite.js'

interface MysqlConnection {
  user: string
  password: string
  database: string
  port: number
}

test.group('Kysely | Mysql driver', (group) => {
  registerCacheDriverTestSuite({
    test,
    group,
    supportsMilliseconds: false,
    createDriver: (options) => {
      const config = getDbConfig(DatabaseType.MYSQL)
      const connection = config.connection as MysqlConnection

      const db = new Kysely<any>({
        dialect: new MysqlDialect({
          pool: createPool({
            user: connection.user,
            password: connection.password,
            database: connection.database,
            port: connection.port,
          }),
        }),
      })

      return createKyselyStore({ connection: db, prefix: 'japa', ...options })
    },
  })
})
