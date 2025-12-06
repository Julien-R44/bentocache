import { test } from '@japa/runner'
import { Redis as IoRedis } from 'ioredis'

import { VALKEY_CREDENTIALS } from '../helpers/index.js'
import { RedisDriver } from '../../src/drivers/redis.js'
import { registerCacheDriverTestSuite } from '../helpers/driver_test_suite.js'

test.group('Valkey driver', (group) => {
  registerCacheDriverTestSuite({
    test,
    group,
    createDriver: (options) =>
      new RedisDriver({ prefix: 'japa', connection: VALKEY_CREDENTIALS, ...options }),
  })

  test('should be able to provide an instance of ioredis', async ({ assert }) => {
    const ioredis = new IoRedis(VALKEY_CREDENTIALS)
    const valkey = new RedisDriver({ connection: ioredis })

    assert.equal(valkey.getConnection(), ioredis)

    await valkey.disconnect()
    await ioredis.quit()
  })

  test('should works with ioredis keyPrefix', async ({ assert }) => {
    const ioredis = new IoRedis({ ...VALKEY_CREDENTIALS, keyPrefix: 'test:' })
    const ioRedis2 = new IoRedis({ ...VALKEY_CREDENTIALS })
    const valkey = new RedisDriver({ connection: ioredis, prefix: 'japa' })

    await valkey.set('key', 'value')
    await valkey.namespace('foo').set('key', 'value2')

    const r1 = await ioRedis2.get('test:japa:key')
    const r2 = await ioRedis2.get('test:japa:foo:key')

    await valkey.namespace('foo').clear()

    const r3 = await ioRedis2.get('test:japa:foo:key')

    assert.equal(r1, 'value')
    assert.equal(r2, 'value2')
    assert.equal(r3, null)

    await ioredis.quit()
    await ioRedis2.quit()
  })

  test('deleteMany should work without CROSSSLOT error', async ({ assert }) => {
    const valkey = new RedisDriver({ prefix: 'japa', connection: VALKEY_CREDENTIALS })

    await valkey.set('key1', 'value1')
    await valkey.set('key2', 'value2')
    await valkey.set('key3', 'value3')

    const result = await valkey.deleteMany(['key1', 'key2', 'key3'])

    assert.isTrue(result)
    assert.isUndefined(await valkey.get('key1'))
    assert.isUndefined(await valkey.get('key2'))
    assert.isUndefined(await valkey.get('key3'))

    await valkey.disconnect()
  })

  test('clear should work without CROSSSLOT error', async ({ assert }) => {
    const valkey = new RedisDriver({ prefix: 'japa-clear-test', connection: VALKEY_CREDENTIALS })

    await valkey.set('key1', 'value1')
    await valkey.set('key2', 'value2')
    await valkey.set('key3', 'value3')

    await valkey.clear()

    assert.isUndefined(await valkey.get('key1'))
    assert.isUndefined(await valkey.get('key2'))
    assert.isUndefined(await valkey.get('key3'))

    await valkey.disconnect()
  })

  test('namespace clear should work without CROSSSLOT error', async ({ assert }) => {
    const valkey = new RedisDriver({ prefix: 'japa-ns-clear', connection: VALKEY_CREDENTIALS })
    const namespace = valkey.namespace('users')

    await valkey.set('key1', 'value1')
    await namespace.set('key2', 'value2')
    await namespace.set('key3', 'value3')

    await namespace.clear()

    assert.equal(await valkey.get('key1'), 'value1')
    assert.isUndefined(await namespace.get('key2'))
    assert.isUndefined(await namespace.get('key3'))

    await valkey.disconnect()
  })
})
