import { test } from '@japa/runner'
import { createDb } from 'orchid-orm'

import { createOrchidStore } from './helpers.js'
import { DatabaseType, getDbConfig } from '../../helpers/db_config.js'
import { registerCacheDriverTestSuite } from '../../../src/test_suite.js'

export interface PostgresConnection {
  user: string
  password: string
}

test.group('Orchid | Postgres driver', (group) => {
  registerCacheDriverTestSuite({
    test,
    group,
    supportsMilliseconds: false,
    createDriver: (options) => {
      const config = getDbConfig(DatabaseType.POSTGRES)
      const connection = config.connection as PostgresConnection

      const db = createDb({
        user: connection.user,
        password: connection.password,
      })

      return createOrchidStore({ connection: db, prefix: 'japa', ...options })
    },
  })
})
