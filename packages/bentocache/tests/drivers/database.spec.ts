import knex from 'knex'
import { test } from '@japa/runner'
import { sleep } from '@julr/utils/misc'

import { DatabaseDriver } from '../../src/drivers/database/database.js'
import { KnexAdapter } from '../../src/drivers/database/adapters/knex.js'

test.group('Database driver', () => {
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

    await sleep(1000)

    const hasFoo = await db('cache').where('key', 'foo').first()
    const hasFoo2 = await db('cache').where('key', 'foo2').first()

    assert.isUndefined(hasFoo)
    assert.isUndefined(hasFoo2)
  })

  test('should prune when calling prune()', async ({ assert, cleanup }) => {
    const db = knex({
      client: 'better-sqlite3',
      connection: { filename: ':memory:' },
      useNullAsDefault: true,
    })

    const driver = new DatabaseDriver(new KnexAdapter({ connection: db }), {
      tableName: 'cache',
      autoCreateTable: true,
    })
    cleanup(() => driver.disconnect())

    await driver.set('foo', 'bar', 300)
    await driver.set('foo2', 'bar', 300)
    assert.equal(await driver.get('foo'), 'bar')
    assert.equal(await driver.get('foo2'), 'bar')

    await sleep(400)
    await driver.prune()

    const hasFoo = await db('cache').where('key', 'foo').first()
    const hasFoo2 = await db('cache').where('key', 'foo2').first()

    assert.isUndefined(hasFoo)
    assert.isUndefined(hasFoo2)
  })

  test('should prune in batches when pruneBatchSize is set', async ({ assert, cleanup }) => {
    const db = knex({
      client: 'better-sqlite3',
      connection: { filename: ':memory:' },
      useNullAsDefault: true,
    })

    const driver = new DatabaseDriver(new KnexAdapter({ connection: db }), {
      tableName: 'cache',
      autoCreateTable: true,
      pruneBatchSize: 2,
    })
    cleanup(() => driver.disconnect())

    // 5 entries, batches of 2: 2 + 2 + 1, and the loop stops on the batch that
    // comes back short instead of asking a fourth time for an empty table.
    for (const key of ['a', 'b', 'c', 'd', 'e']) await driver.set(key, 'bar', 300)
    await sleep(400)

    const adapter = new KnexAdapter({ connection: db })
    adapter.setTableName('cache')
    const deleted = await adapter.pruneExpiredEntries({ limit: 2 })
    assert.equal(deleted, 2)

    await driver.prune()

    const remaining = await db('cache').select('key')
    assert.deepEqual(remaining, [])
  })

  test('should honor an explicit batch size of 1 without looping forever', async ({
    assert,
    cleanup,
  }) => {
    const db = knex({
      client: 'better-sqlite3',
      connection: { filename: ':memory:' },
      useNullAsDefault: true,
    })

    const driver = new DatabaseDriver(new KnexAdapter({ connection: db }), {
      tableName: 'cache',
      autoCreateTable: true,
      pruneBatchSize: 1,
    })
    cleanup(() => driver.disconnect())

    for (const key of ['a', 'b', 'c']) await driver.set(key, 'bar', 300)
    await sleep(400)

    await driver.prune()
    assert.deepEqual(await db('cache').select('key'), [])
  })

  test('should delete expired item with correct prefixed key', async ({ assert, cleanup }) => {
    const db = knex({
      client: 'better-sqlite3',
      connection: { filename: ':memory:' },
      useNullAsDefault: true,
    })

    const driver = new DatabaseDriver(new KnexAdapter({ connection: db }), {
      tableName: 'cache',
      autoCreateTable: true,
      prefix: 'test',
      pruneInterval: false,
    })
    cleanup(() => driver.disconnect())

    await driver.set('foo', 'bar', 100)

    const hasKeyBefore = await db('cache').where('key', 'test:foo').first()
    assert.isDefined(hasKeyBefore)

    await sleep(150)

    const result = await driver.get('foo')
    assert.isUndefined(result)

    const hasKeyAfter = await db('cache').where('key', 'test:foo').first()
    assert.isUndefined(hasKeyAfter)
  })
})
