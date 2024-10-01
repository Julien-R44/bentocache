import { test } from '@japa/runner'
import { setTimeout } from 'node:timers/promises'
import { MemoryTransport } from '@boringnode/bus/transports/memory'

import { ChaosBus } from '../helpers/chaos/chaos_bus.js'
import { ChaosCache } from '../helpers/chaos/chaos_cache.js'
import { CacheBusMessageType } from '../../src/types/bus.js'
import { CacheFactory } from '../../factories/cache_factory.js'
import { RedisDriver, redisBusDriver } from '../../src/drivers/redis.js'
import { REDIS_CREDENTIALS, throwingFactory } from '../helpers/index.js'

test.group('Bus synchronization', () => {
  test('synchronize multiple cache', async ({ assert }) => {
    const key = 'foo'

    const [cache1] = new CacheFactory().withL1L2Config().create()
    const [cache2] = new CacheFactory().withL1L2Config().create()
    const [cache3] = new CacheFactory().withL1L2Config().create()

    await cache1.set(key, 24)
    await setTimeout(100)

    assert.equal(await cache1.get(key), 24)
    assert.equal(await cache2.get(key), 24)
    assert.equal(await cache3.get(key), 24)

    await cache1.delete(key)

    await setTimeout(100)

    assert.isUndefined(await cache1.get(key))
    assert.isUndefined(await cache2.get(key))
    assert.isUndefined(await cache3.get(key))
  }).disableTimeout()

  test('synchronize multiple cache with namespace', async ({ assert }) => {
    const key = 'foo'

    const [cache1] = new CacheFactory().withL1L2Config().create()
    const [cache2] = new CacheFactory().withL1L2Config().create()
    const [cache3] = new CacheFactory().withL1L2Config().create()

    const cache1NSUsersMe = cache1.namespace('users').namespace('me')
    const cache2NSUsersMe = cache2.namespace('users').namespace('me')
    const cache3NSAdmin = cache3.namespace('admin')

    await cache1NSUsersMe.set(key, 24)
    await cache3NSAdmin.set(key, 42)
    await setTimeout(100)

    assert.equal(await cache1NSUsersMe.get(key), 24)
    assert.equal(await cache2NSUsersMe.get(key), 24)
    assert.equal(await cache3NSAdmin.get(key), 42)

    await cache1NSUsersMe.clear()

    await setTimeout(100)

    assert.isUndefined(await cache1NSUsersMe.get(key))
    assert.isUndefined(await cache2.namespace('users').namespace('me').get(key))
    assert.equal(await cache3NSAdmin.get(key), 42)

    await cache2.namespace('admin').clear()
    await setTimeout(100)

    assert.isUndefined(await cache3NSAdmin.get(key))
  }).disableTimeout()

  test('retry queue processing', async ({ assert }) => {
    const bus1 = new ChaosBus(new MemoryTransport())
    const bus2 = new ChaosBus(new MemoryTransport())
    const bus3 = new ChaosBus(new MemoryTransport())

    const busOptions = { retryQueue: { enabled: true, retryInterval: 100 } }
    const [cache1] = new CacheFactory()
      .withL1L2Config()
      .merge({ busDriver: bus1, busOptions })
      .create()
    const [cache2] = new CacheFactory()
      .withL1L2Config()
      .merge({ busDriver: bus2, busOptions })
      .create()
    const [cache3] = new CacheFactory()
      .withL1L2Config()
      .merge({ busDriver: bus3, busOptions })
      .create()

    bus1.alwaysThrow()
    bus2.alwaysThrow()
    bus3.alwaysThrow()

    await setTimeout(100)

    await cache1.set('foo', 1)
    await setTimeout(200)

    await cache2.set('foo', 2)
    await setTimeout(200)

    await cache3.set('foo', 3)
    await setTimeout(200)

    assert.deepEqual(await cache1.get('foo'), 1)
    assert.deepEqual(await cache2.get('foo'), 2)
    assert.deepEqual(await cache3.get('foo'), 3)

    // Enable the bus
    bus1.neverThrow()
    bus2.neverThrow()
    bus3.neverThrow()

    await setTimeout(200)

    assert.deepEqual(await cache1.get('foo'), 3)
    assert.deepEqual(await cache2.get('foo'), 3)
    assert.deepEqual(await cache3.get('foo'), 3)
  }).disableTimeout()

  test('should not process retry queue if disabled', async ({ assert }) => {
    const bus1 = new ChaosBus(new MemoryTransport())
    const bus2 = new ChaosBus(new MemoryTransport())

    const [cache] = new CacheFactory()
      .withL1L2Config()
      .merge({ busDriver: bus1, busOptions: { retryQueue: { enabled: false } } })
      .create()

    const [cache2] = new CacheFactory()
      .withL1L2Config()
      .merge({ busDriver: bus2, busOptions: { retryQueue: { enabled: false } } })
      .create()

    bus1.alwaysThrow()
    bus2.alwaysThrow()

    await cache.set('foo', 1)
    await cache2.set('foo', 2)

    await setTimeout(200)

    bus1.neverThrow()
    bus2.neverThrow()

    await cache.set('foo2', 1)

    await setTimeout(200)

    assert.deepEqual(await cache.get('foo'), 1)
    assert.deepEqual(await cache2.get('foo'), 2)
  })

  test('should queue maximum X items when retryQueue.maxSize is enabled', async ({ assert }) => {
    const bus1 = new ChaosBus(new MemoryTransport())
    const bus2 = new MemoryTransport()

    const [cache1] = new CacheFactory()
      .withL1L2Config()
      .merge({
        busDriver: bus1,
        busOptions: { retryQueue: { enabled: true, maxSize: 20, retryInterval: 100 } },
      })
      .create()

    const [] = new CacheFactory().withL1L2Config().merge({ busDriver: bus2 }).create()

    bus1.alwaysThrow()

    for (let i = 0; i < 30; i++) {
      await cache1.set(`foo-${i}`, i)
    }

    bus1.neverThrow()
    assert.deepEqual(bus2.receivedMessages.length, 0)

    await setTimeout(1000)

    assert.deepEqual(bus2.receivedMessages.length, 20)
  }).disableTimeout()

  test('when a entry is set other nodes should just logically invalidate the entry but keep for grace period', async ({
    assert,
    cleanup,
  }) => {
    const remoteDriver = new ChaosCache(new RedisDriver({ connection: REDIS_CREDENTIALS }))

    cleanup(() => remoteDriver.disconnect().catch(() => {}))

    const [cache1] = new CacheFactory()
      .merge({ l2Driver: remoteDriver, gracePeriod: { enabled: true, duration: '12h' } })
      .withL1L2Config()
      .create()

    const [cache2] = new CacheFactory()
      .merge({ l2Driver: remoteDriver, ttl: 100, gracePeriod: { enabled: true, duration: '12h' } })
      .withL1L2Config()
      .create()

    remoteDriver.alwaysThrow()

    await cache1.set('foo', 'bar')
    await cache2.set('foo', 'baz')

    await setTimeout(110)

    remoteDriver.neverThrow()
    const result = await cache1.getOrSet('foo', throwingFactory('fail'))

    /**
     * Summary :
     * - We failed to set `foo`: `baz` in the remote driver
     * - Bus successfully published the invalidation message
     * - Bus should have only invalidated and not totally deleted the old
     *  `foo`: `bar` entry. So, we should be able to get it since
     *   grace period is enabled
     */
    assert.deepEqual(result, 'bar')
  })

  test('binary encoding/decoding should works fine', async ({ assert, cleanup }, done) => {
    const bus1 = redisBusDriver({ connection: REDIS_CREDENTIALS })
      .factory(null as any)
      .setId('foo')

    const bus2 = redisBusDriver({ connection: REDIS_CREDENTIALS })
      .factory(null as any)
      .setId('bar')

    cleanup(async () => {
      await bus1.disconnect()
      await bus2.disconnect()
    })

    const data = {
      keys: ['foo', '1', '2', 'bar', 'key::test'],
      type: CacheBusMessageType.Set,
    }

    bus1.subscribe('foo', (message: any) => {
      assert.deepInclude(message, data)
      done()
    })

    await setTimeout(200)

    await bus2.publish('foo', data)
  })
    .waitForDone()
    .disableTimeout()

  test('works with utf8 characters', async ({ assert }, done) => {
    const bus1 = redisBusDriver({ connection: REDIS_CREDENTIALS })
      .factory(null as any)
      .setId('foo')

    const bus2 = redisBusDriver({ connection: REDIS_CREDENTIALS })
      .factory(null as any)
      .setId('bar')

    const data = {
      keys: ['foo', '1', '2', 'bar', 'key::test', '🚀'],
      type: CacheBusMessageType.Set,
    }

    bus1.subscribe('foo', (message: any) => {
      assert.deepInclude(message, data)
      done()
    })

    await setTimeout(200)

    await bus2.publish('foo', data)

    await bus1.disconnect()

    await bus2.disconnect()

    await setTimeout(200)
  }).waitForDone()
})
