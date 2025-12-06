import { test } from '@japa/runner'
import { Redis as IoRedis, Cluster as IoRedisCluster } from 'ioredis'

import { REDIS_CREDENTIALS } from '../helpers/index.js'
import { RedisDriver } from '../../src/drivers/redis.js'
import { registerCacheDriverTestSuite } from '../helpers/driver_test_suite.js'

test.group('Redis driver', (group) => {
  registerCacheDriverTestSuite({
    test,
    group,
    createDriver: (options) =>
      new RedisDriver({ prefix: 'japa', connection: REDIS_CREDENTIALS, ...options }),
  })

  test('should be able to provide an instance of ioredis', async ({ assert }) => {
    const ioredis = new IoRedis(REDIS_CREDENTIALS)
    const redis2 = new RedisDriver({ connection: ioredis })

    assert.equal(redis2.getConnection(), ioredis)

    await redis2.disconnect()
    await ioredis.quit()
  })

  test('should be able to provide an instance of ioredis cluster', async ({ assert }) => {
    const cluster = new IoRedisCluster([{ host: '127.0.0.1', port: 7000 }])
    const redis = new RedisDriver({ connection: cluster })

    assert.equal(redis.getConnection(), cluster)

    await redis.disconnect()
  }).skip(!!process.env.CI, 'Skipping cluster test on CI')

  test('should works with ioredis keyPrefix', async ({ assert }) => {
    const ioredis = new IoRedis({ ...REDIS_CREDENTIALS, keyPrefix: 'test:' })
    const ioRedis2 = new IoRedis({ ...REDIS_CREDENTIALS })
    const redis2 = new RedisDriver({ connection: ioredis, prefix: 'japa' })

    await redis2.set('key', 'value')
    await redis2.namespace('foo').set('key', 'value2')

    const r1 = await ioRedis2.get('test:japa:key')
    const r2 = await ioRedis2.get('test:japa:foo:key')

    await redis2.namespace('foo').clear()

    const r3 = await ioRedis2.get('test:japa:foo:key')

    assert.equal(r1, 'value')
    assert.equal(r2, 'value2')
    assert.equal(r3, null)

    await ioredis.quit()
    await ioRedis2.quit()
  })
})
