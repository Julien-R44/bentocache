import knex from 'knex'
import { test } from '@japa/runner'
import { sleep } from '@julr/utils/misc'

import { createKnexStore } from './helpers.js'
import { DatabaseType, getDbConfig } from '../../helpers/db_config.js'
import { registerCacheDriverTestSuite } from '../../helpers/driver_test_suite.js'

test.group('Knex | MySQL driver', (group) => {
  registerCacheDriverTestSuite({
    test,
    group,
    supportsMilliseconds: false,
    createDriver: (options) => {
      const db = knex(getDbConfig(DatabaseType.MYSQL))
      return createKnexStore({ connection: db, prefix: 'japa', ...options })
    },
  })

  test('should not throw error when disconnecting immediately', async () => {
    const db = knex(getDbConfig(DatabaseType.MYSQL))

    const store = createKnexStore({ connection: db, prefix: 'japa' })

    await store.disconnect()
    await sleep(1000)
    await store.disconnect()
    await db.destroy()
  })
})
