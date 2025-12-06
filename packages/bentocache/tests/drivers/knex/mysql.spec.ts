import knex from 'knex'
import { test } from '@japa/runner'
import { sleep } from '@julr/utils/misc'

import { createKnexStore } from './helpers.js'
import { registerCacheDriverTestSuite } from '../../helpers/driver_test_suite.js'

test.group('Knex | MySQL driver', (group) => {
  registerCacheDriverTestSuite({
    test,
    group,
    supportsMilliseconds: false,
    createDriver: (options) => {
      const db = knex({
        client: 'mysql2',
        connection: { user: 'root', password: 'root', database: 'mysql', port: 3306 },
      })

      return createKnexStore({ connection: db, prefix: 'japa', ...options })
    },
  })

  test('should not throw error when disconnecting immediately', async () => {
    const db = knex({
      client: 'mysql2',
      connection: { user: 'root', password: 'root', database: 'mysql', port: 3306 },
    })

    const store = createKnexStore({ connection: db, prefix: 'japa' })

    await store.disconnect()
    await sleep(1000)
    await store.disconnect()
    await db.destroy()
  })
})
