import knex from 'knex'
import { test } from '@japa/runner'
import { setTimeout } from 'node:timers/promises'

import { DatabaseDriver } from '../../src/drivers/database/database.js'
import { KnexAdapter } from '../../src/drivers/database/adapters/knex.js'

test.group('Database', () => {
  test('should prune expired items every x seconds', async ({ assert, cleanup }) => {
    const db = knex({
      client: 'better-sqlite3',
      connection: { filename: ':memory:' },
      useNullAsDefault: true,
    })

    const driver = new DatabaseDriver(new KnexAdapter({ connection: db }), {
      tableName: 'cache',
      autoCreateTable: true,
      pruneInterval: 500,
    })

    cleanup(() => driver.disconnect())

    await driver.set('foo', 'bar', 300)
    await driver.set('foo2', 'bar', 300)

    assert.equal(await driver.get('foo'), 'bar')

    await setTimeout(1000)

    const hasFoo = await db('cache').where('key', 'foo').first()
    const hasFoo2 = await db('cache').where('key', 'foo2').first()

    assert.isUndefined(hasFoo)
    assert.isUndefined(hasFoo2)
  })
})
