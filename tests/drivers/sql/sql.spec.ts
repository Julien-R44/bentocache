import Knex from 'knex'
import { test } from '@japa/runner'

import { Sql } from '../../../src/drivers/sql.js'
import type { SqlConfig } from '../../../src/types/main.js'

test.group('BaseSql', () => {
  test('should re-use knex instance if given', async ({ assert, cleanup }) => {
    class MyDriver extends Sql {
      constructor(config: SqlConfig) {
        super({ ...config, dialect: 'better-sqlite3' })
      }

      getKnex() {
        return this.connection
      }
    }

    const knex = Knex({
      client: 'better-sqlite3',
      connection: ':memory:',
      useNullAsDefault: true,
    })

    const driver = new MyDriver({ connection: knex })
    cleanup(() => driver.disconnect())

    await driver.get('foo')

    assert.equal(driver.getKnex(), knex)
  })
})
