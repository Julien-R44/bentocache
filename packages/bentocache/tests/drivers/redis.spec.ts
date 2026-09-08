import { test } from '@japa/runner'
import { Redis as IoRedis, Cluster as IoRedisCluster } from 'ioredis'
import { Redis as IoRedisV6, Cluster as IoRedisV6Cluster } from 'ioredis-v6'

import { REDIS_CREDENTIALS } from '../helpers/index.js'
import { RedisDriver, redisBusDriver } from '../../src/drivers/redis.js'
import { registerCacheDriverTestSuite } from '../helpers/driver_test_suite.js'

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

  /**
   * `ioredis-v6` is a second, genuine ioredis install ( `"ioredis-v6":
   * "npm:ioredis@^6.0.0"` in devDependencies ) living side by side with the
   * `ioredis@5` the driver itself resolves.
   *
   * A client built from it is exactly what a host application on a different
   * `ioredis` major hands to bentocache, and the `instanceof` checks the driver
   * used to rely on classified it as a plain connection options object: the
   * driver silently built a brand new connection to `127.0.0.1:6379` instead of
   * reusing the client it was given.
   */
  test('should reuse a client built by another ioredis major', async ({ assert, cleanup }) => {
    /**
     * Any database but `0`. The failure mode we guard against ends up on
     * `127.0.0.1:6379` **db 0**, so writing on another database is what proves
     * the write went through the client we were handed rather than through a
     * connection the driver conjured up on its own.
     */
    const foreignClient = new IoRedisV6({ ...REDIS_CREDENTIALS, db: 3 })
    const fallbackClient = new IoRedis(REDIS_CREDENTIALS)

    cleanup(async () => {
      await foreignClient.flushdb()
      foreignClient.disconnect()
      await fallbackClient.quit()
    })

    /**
     * The whole point of the fixture: a real client that is genuinely not of
     * the class the driver would test against.
     */
    assert.instanceOf(foreignClient, IoRedisV6)
    assert.notInstanceOf(foreignClient, IoRedis)

    const driver = new RedisDriver({
      connection: foreignClient as unknown as IoRedis,
      prefix: 'japa',
    })

    assert.equal(driver.getConnection(), foreignClient)

    await driver.set('foreign', 'value')

    /**
     * Delivery landed on the server the given client is connected to...
     */
    assert.equal(await foreignClient.get('japa:foreign'), 'value')

    /**
     * ...and not on the `127.0.0.1:6379` db 0 the silent fallback would have
     * used.
     */
    assert.isNull(await fallbackClient.get('japa:foreign'))
  })

  test('should reuse a Cluster built by another ioredis major', async ({ assert, cleanup }) => {
    const foreignCluster = new IoRedisV6Cluster([{ host: '127.0.0.1', port: 7000 }], {
      lazyConnect: true,
    })
    cleanup(() => foreignCluster.disconnect())

    assert.instanceOf(foreignCluster, IoRedisV6Cluster)
    assert.notInstanceOf(foreignCluster, IoRedisCluster)

    const driver = new RedisDriver({ connection: foreignCluster as unknown as IoRedisCluster })

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
     * Not reachable with a real client of any major: shaped like a client
     * (`status` / `options` / `emit`) but missing the methods we discriminate
     * on. We must refuse rather than treat it as an options bag and dial
     * 127.0.0.1:6379.
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
    const foreignClient = new IoRedisV6({ ...REDIS_CREDENTIALS, lazyConnect: true })

    assert.instanceOf(foreignClient, IoRedisV6)
    assert.notInstanceOf(foreignClient, IoRedis)

    /**
     * Unlike `RedisDriver`, the bus driver hands the connection to
     * `RedisTransport`, which keeps it private. And a bare v6 client cannot
     * discriminate the two code paths from the outside: `RedisTransport`
     * performs the very same `instanceof` check, so it also fails to recognize
     * a foreign-major client and builds its own connection either way. That
     * one has to be fixed one layer down, in `@boringnode/bus`
     * ( boringnode/bus#71 ).
     *
     * So we observe the only thing that is ours to get right: the client is
     * passed *by reference* instead of being shallow-copied into an options
     * bag. The real v6 client is fronted by a recorder over a null-prototype
     * target, which has no own enumerable key: `{ ...connection }` would
     * therefore read nothing, and any property access proves the object itself
     * was forwarded.
     */
    let connectionWasForwarded = false
    const recordedClient = new Proxy(Object.create(null) as IoRedis, {
      get(_target, property) {
        connectionWasForwarded = true
        const value = (foreignClient as any)[property]
        return typeof value === 'function' ? value.bind(foreignClient) : value
      },
    })

    const bus = redisBusDriver({ connection: recordedClient }).factory(null as any)
    cleanup(async () => {
      await bus.disconnect().catch(() => {})
      foreignClient.disconnect()
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
