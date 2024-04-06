import knex from 'knex'
import { test } from '@japa/runner'
import { setTimeout } from 'node:timers/promises'

import { KnexAdapter } from '../../src/drivers/knex.js'
import { DatabaseStore } from '../../src/drivers/database.js'

test.group('Database', () => {
  test('should prune expired items every x seconds', async ({ assert, cleanup }) => {
    const adapter = new KnexAdapter({
      connection: knex({
        client: 'better-sqlite3',
        connection: { filename: ':memory:' },
        useNullAsDefault: true,
      }),
    })

    const driver = new DatabaseStore(adapter, {
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
