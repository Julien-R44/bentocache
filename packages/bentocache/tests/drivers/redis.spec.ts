import { test } from '@japa/runner'
import { Redis as IoRedis, Cluster as IoRedisCluster } from 'ioredis'

import { REDIS_CREDENTIALS } from '../helpers/index.js'
import { RedisDriver, redisBusDriver } from '../../src/drivers/redis.js'
import { registerCacheDriverTestSuite } from '../helpers/driver_test_suite.js'

/**
 * Wraps a real ioredis client into a facade that has the exact same shape but
 * is NOT `instanceof` the `ioredis` copy bentocache resolved.
 *
 * This is what a client built by a *different* ioredis major looks like from
 * inside bentocache, and it is the case the old `instanceof` check got wrong:
 * it classified the client as a connection options object and silently built a
 * brand new connection to 127.0.0.1:6379.
 */
function asForeignMajorClient<T extends object>(client: T): T {
  return new Proxy(Object.create(null) as T, {
    get(_target, property) {
      const value = (client as any)[property]
      return typeof value === 'function' ? value.bind(client) : value
    },
  })
}

test.group('Redis driver', (group) => {
  registerCacheDriverTestSuite({
    test,
    group,
    createDriver: (options) =>
      new RedisDriver({ prefix: 'japa', connection: REDIS_CREDENTIALS, ...options }),
  })

  test('should be able to provide an instance of ioredis', async ({ assert, cleanup }) => {
    const ioredis = new IoRedis(REDIS_CREDENTIALS)
    const redis2 = new RedisDriver({ connection: ioredis })

    cleanup(async () => {
      await redis2.disconnect()
      await ioredis.quit()
    })

    assert.equal(redis2.getConnection(), ioredis)
  })

  test('should be able to provide an instance of ioredis cluster', async ({ assert, cleanup }) => {
    const cluster = new IoRedisCluster([{ host: '127.0.0.1', port: 7000 }])
    const redis = new RedisDriver({ connection: cluster })

    cleanup(async () => {
      await redis.disconnect()
      cluster.disconnect()
    })

    assert.equal(redis.getConnection(), cluster)
  }).skip(!!process.env.CI, 'Skipping cluster test on CI')

  test('should work with ioredis keyPrefix', async ({ assert, cleanup }) => {
    const ioredis = new IoRedis({ ...REDIS_CREDENTIALS, keyPrefix: 'test:' })
    const ioRedis2 = new IoRedis({ ...REDIS_CREDENTIALS })
    const redis2 = new RedisDriver({ connection: ioredis, prefix: 'japa' })

    cleanup(async () => {
      await redis2.disconnect()
      await ioRedis2.quit()
      await ioredis.quit()
    })

    await redis2.set('key', 'value')
    await redis2.namespace('foo').set('key', 'value2')

    const r1 = await ioRedis2.get('test:japa:key')
    const r2 = await ioRedis2.get('test:japa:foo:key')

    await redis2.namespace('foo').clear()

    const r3 = await ioRedis2.get('test:japa:foo:key')

    assert.equal(r1, 'value')
    assert.equal(r2, 'value2')
    assert.equal(r3, null)
  })

  test('should reuse a client built by another ioredis major', async ({ assert, cleanup }) => {
    const ioredis = new IoRedis(REDIS_CREDENTIALS)
    const foreignClient = asForeignMajorClient(ioredis)

    assert.isFalse(
      foreignClient instanceof IoRedis,
      'the fixture must not be `instanceof` our own ioredis, otherwise it tests nothing',
    )

    const driver = new RedisDriver({ connection: foreignClient, prefix: 'japa' })
    cleanup(async () => {
      await driver.disconnect()
      await ioredis.quit()
    })

    assert.equal(driver.getConnection(), foreignClient)

    /**
     * And it must be a working connection, not a stray one pointing at localhost
     */
    await driver.set('foreign', 'value')
    assert.equal(await ioredis.get('japa:foreign'), 'value')
  })

  test('should reuse a Cluster built by another ioredis major', async ({ assert, cleanup }) => {
    const cluster = new IoRedisCluster([{ host: '127.0.0.1', port: 7000 }], { lazyConnect: true })
    const foreignCluster = asForeignMajorClient(cluster)

    assert.isFalse(foreignCluster instanceof IoRedisCluster)

    const driver = new RedisDriver({ connection: foreignCluster })
    cleanup(() => cluster.disconnect())

    assert.equal(driver.getConnection(), foreignCluster)
  })

  test('should build a new connection when given connection options', async ({
    assert,
    cleanup,
  }) => {
    const connection = { ...REDIS_CREDENTIALS, keyPrefix: 'opts:' }
    const driver = new RedisDriver({ connection })
    cleanup(() => driver.disconnect())

    const created = driver.getConnection() as IoRedis

    assert.notStrictEqual(created as any, connection)
    assert.instanceOf(created, IoRedis)
    assert.equal(created.options.host, connection.host)
    assert.equal(created.options.port, connection.port)
    assert.equal(created.options.keyPrefix, 'opts:')
  })

  test('should throw instead of silently connecting to localhost on an unrecognized client', async ({
    assert,
  }) => {
    /**
     * Shaped like a client (`status` / `options` / `emit`) but missing the
     * methods we discriminate on. We must refuse rather than treat it as an
     * options bag and dial 127.0.0.1:6379.
     */
    const unknownClient = { status: 'ready', options: { host: 'redis.internal' }, emit: () => true }

    assert.throws(
      () => new RedisDriver({ connection: unknownClient as any }),
      /looks like a Redis client/,
    )
  })

  test('bus driver should forward a client built by another ioredis major', async ({
    assert,
    cleanup,
  }) => {
    const ioredis = new IoRedis(REDIS_CREDENTIALS)

    /**
     * A Proxy over a null-prototype target has no own enumerable keys, so if the
     * connection were misclassified as options and shallow-copied into
     * `{ ...connection, useMessageBuffer: true }` the object itself would never
     * be read. Any property access therefore proves the live client was handed
     * to `RedisTransport` as-is.
     */
    let connectionWasForwarded = false
    const foreignClient = new Proxy(Object.create(null) as IoRedis, {
      get(_target, property) {
        connectionWasForwarded = true
        const value = (ioredis as any)[property]
        return typeof value === 'function' ? value.bind(ioredis) : value
      },
    })

    assert.isFalse(foreignClient instanceof IoRedis)

    const bus = redisBusDriver({ connection: foreignClient }).factory(null as any)
    cleanup(async () => {
      await bus.disconnect().catch(() => {})
      await ioredis.quit()
    })

    assert.isTrue(connectionWasForwarded)
  })

  test('bus driver should throw on an unrecognized client', async ({ assert }) => {
    const unknownClient = { status: 'ready', options: { host: 'redis.internal' }, emit: () => true }

    assert.throws(
      () => redisBusDriver({ connection: unknownClient as any }).factory(null as any),
      /looks like a Redis client/,
    )
  })
})
