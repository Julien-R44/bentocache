import knex from 'knex'
import { test } from '@japa/runner'
import { sleep } from '@julr/utils/misc'

import { createKnexStore } from './helpers.js'
import { MYSQL_CREDENTIALS } from '../../helpers/index.js'
import { registerCacheDriverTestSuite } from '../../helpers/driver_test_suite.js'

test.group('Knex | Mysql driver', (group) => {
  registerCacheDriverTestSuite({
    test,
    group,
    supportsMilliseconds: false,
    createDriver: (options) => {
      const db = knex({
        client: 'mysql2',
        connection: { ...MYSQL_CREDENTIALS },
      })

      return createKnexStore({ connection: db, prefix: 'japa', ...options })
    },
  })

  test('should not throw error when disconnecting immediately', async ({ cleanup }) => {
    const db = knex({
      client: 'mysql2',
      connection: { ...MYSQL_CREDENTIALS },
    })
    cleanup(() => db.destroy())

    const store = createKnexStore({ connection: db, prefix: 'japa' })

    await store.disconnect()
    await sleep(1000)
    await store.disconnect()
  })
})
