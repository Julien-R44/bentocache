import Knex from 'knex'
import { test } from '@japa/runner'
import { setTimeout } from 'node:timers/promises'

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

  test('should prune expired items every x seconds', async ({ assert, cleanup }) => {
    const driver = new Sql({
      dialect: 'better-sqlite3',
      connection: {
        driver: 'better-sqlite3',
        filename: ':memory:',
      },
      tableName: 'cache',
      autoCreateTable: true,
      pruneInterval: 500,
    })

    cleanup(() => driver.disconnect())

    await driver.set('foo', 'bar', 300)
    await driver.set('foo2', 'bar', 300)

    assert.equal(await driver.get('foo'), 'bar')

    await setTimeout(1000)

    assert.isUndefined(await driver.get('foo'))
    assert.isUndefined(await driver.get('foo2'))
  })
})
