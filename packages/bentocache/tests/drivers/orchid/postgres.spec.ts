import { test } from '@japa/runner'
import { createDb } from 'orchid-orm'
import { createOrchidStore } from './helpers.js'
import { registerCacheDriverTestSuite } from '../../../src/test_suite.js'

test.group('Orchid | Postgres driver', (group) => {
  registerCacheDriverTestSuite({
    test,
    group,
    supportsMilliseconds: false,
    createDriver: (options) => {
      const db = createDb({ user: 'postgres', password: 'postgres' })

      return createOrchidStore({ connection: db, prefix: 'japa', ...options })
    },
  })
})
