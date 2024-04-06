import { test } from '@japa/runner'
import { setTimeout } from 'node:timers/promises'

import { RedisDriver } from '../../src/drivers/redis.js'
import { TestLogger } from '../../test_helpers/test_logger.js'
import { CacheFactory } from '../../factories/cache_factory.js'
import { MemoryBus } from '../../src/bus/drivers/memory_bus.js'
import { NullDriver } from '../../test_helpers/null/null_driver.js'
import { ChaosCache } from '../../test_helpers/chaos/chaos_cache.js'
import { throwingFactory, slowFactory, REDIS_CREDENTIALS } from '../../test_helpers/index.js'

test.group('Cache', () => {
  test('get() returns null if null is stored', async ({ assert }) => {
    const { cache } = new CacheFactory().withL1L2Config().create()

    await cache.set('foo', null)
    const value = await cache.get('foo')

    assert.isNull(value)
  })

  test('getOrSet returns null if null is stored', async ({ assert }) => {
    const { cache } = new CacheFactory().withL1L2Config().create()

    await cache.set('foo', null)
    const value = await cache.getOrSet('foo', throwingFactory('should not be called'))

    assert.isNull(value)
  })

  test('value not in local but in remote should be returned', async ({ assert }) => {
    const { cache, stack, remote } = new CacheFactory().withL1L2Config().create()

    await remote.set('foo', JSON.stringify({ value: 'bar' }), stack.defaultOptions)

    const value = await cache.get('foo')
    assert.deepEqual(value, 'bar')
  })

  test('value not in local and not in remote should returns undefined', async ({ assert }) => {
    const { cache } = new CacheFactory().withL1L2Config().create()
    const value = await cache.get('foo')

    assert.isUndefined(value)
  })

  test('value only in local should returns value without fetching from remote', async ({
    assert,
  }) => {
    class L2Driver extends NullDriver {
      type = 'l2' as const

      get(): any {
        assert.fail('should not be called')
      }
    }

    const { cache, local, stack } = new CacheFactory()
      .merge({ l2Driver: new L2Driver({}) })
      .withL1L2Config()
      .create()

    local.set('foo', JSON.stringify({ value: 'bar' }), stack.defaultOptions)
    local.set('foo', JSON.stringify({ value: 'bar' }), stack.defaultOptions)
    const r1 = await cache.get('foo')

    assert.deepEqual(r1, 'bar')
  })

  test('return remote item if logically expired and grace is enabled', async ({ assert }) => {
    const { cache, remote, stack } = new CacheFactory()
      .withL1L2Config()
      .merge({ gracePeriod: { enabled: true } })
      .create()

    await remote.set(
      'foo',
      JSON.stringify({ value: 'bar', logicalExpiration: Date.now() - 1000 }),
      stack.defaultOptions,
    )
    const r1 = await cache.get('foo')

    assert.deepEqual(r1, 'bar')
  })

  test('doesnt return remote item if logically expired and grace is disabled', async ({
    assert,
  }) => {
    const { cache, remote, stack } = new CacheFactory()
      .withL1L2Config()
      .merge({ gracePeriod: { enabled: false } })
      .create()

    await remote.set(
      'foo',
      JSON.stringify({ value: 'bar', logicalExpiration: Date.now() - 1000 }),
      stack.defaultOptions,
    )
    const value = await cache.get('foo')

    assert.isUndefined(value)
  })

  test('return local item if logically expired and grace is enabled', async ({ assert }) => {
    const { cache, local, stack } = new CacheFactory()
      .withL1L2Config()
      .merge({ gracePeriod: { enabled: true } })
      .create()

    local.set(
      'foo',
      JSON.stringify({ value: 'bar', logicalExpiration: Date.now() - 1000 }),
      stack.defaultOptions,
    )
    const value = await cache.get('foo')

    assert.deepEqual(value, 'bar')
  })

  test('doesnt return local item if logically expired and grace is disabled', async ({
    assert,
  }) => {
    const { cache, local, stack } = new CacheFactory()
      .withL1L2Config()
      .merge({ gracePeriod: { enabled: false } })
      .create()

    local.set(
      'foo',
      JSON.stringify({ value: 'bar', logicalExpiration: Date.now() - 1000 }),
      stack.defaultOptions,
    )
    const value = await cache.get('foo')

    assert.isUndefined(value)
  })

  test('set item to local store if found in remote', async ({ assert }) => {
    const { cache, local, remote, stack } = new CacheFactory().withL1L2Config().create()

    await remote.set('foo', JSON.stringify({ value: 'bar' }), stack.defaultOptions)
    await cache.get('foo')

    const value = local.get('foo', stack.defaultOptions)
    assert.deepEqual(value?.getValue(), 'bar')
  })

  test('return default value if item not found in local and remote', async ({ assert }) => {
    const { cache } = new CacheFactory().withL1L2Config().create()

    const value = await cache.get('foo', 'bar')
    assert.deepEqual(value, 'bar')
  })

  test('returns value when key exists in local', async ({ assert }) => {
    const { cache, local, stack } = new CacheFactory().withL1L2Config().create()

    local.set('key1', JSON.stringify({ value: 'bar' }), stack.defaultOptions)
    const value = await cache.getOrSet('key1', throwingFactory('should not be called'))

    assert.deepEqual(value, 'bar')
  })

  test('returns value when key exists in remote', async ({ assert }) => {
    const { cache, remote, stack } = new CacheFactory().withL1L2Config().create()

    await remote.set('key1', JSON.stringify({ value: 'bar' }), stack.defaultOptions)
    const value = await cache.getOrSet('key1', throwingFactory('should not be called'))

    assert.deepEqual(value, 'bar')
  })

  test('set value in local when key does not exist in local but exists in remote', async ({
    assert,
  }) => {
    const { cache, local, remote, stack } = new CacheFactory().withL1L2Config().create()

    await remote.set('key1', JSON.stringify({ value: 'bar' }), stack.defaultOptions)
    const value = await cache.getOrSet('key1', throwingFactory('should not be called'))
    const localeValue = local.get('key1', stack.defaultOptions)

    assert.deepEqual(value, 'bar')
    assert.deepEqual(localeValue?.getValue(), 'bar')
  })

  test('store values in both when key does not exists in local and remote', async ({ assert }) => {
    const { cache, local, remote, stack } = new CacheFactory().withL1L2Config().create()

    const value = await cache.getOrSet('key1', slowFactory(40, 'bar'))

    const localeValue = local.get('key1', stack.defaultOptions)
    const remoteValue = await remote.get('key1', stack.defaultOptions)

    assert.deepEqual(value, 'bar')
    assert.deepEqual(localeValue!.getValue(), 'bar')
    assert.deepEqual(remoteValue!.getValue(), 'bar')
  })

  test('with specific ttl', async ({ assert }) => {
    const { cache, local, remote, stack } = new CacheFactory().withL1L2Config().create()

    await cache.getOrSet('key1', () => ({ foo: 'bar' }), {
      ttl: '10ms',
    })

    await setTimeout(20)

    assert.isUndefined(await cache.get('key1'))
    assert.isUndefined(local.get('key1', stack.defaultOptions))
    assert.isUndefined(await remote.get('key1', stack.defaultOptions))
  })

  test('should returns old value if factory throws and grace enabled', async ({ assert }) => {
    assert.plan(3)

    const { cache } = new CacheFactory()
      .withL1L2Config()
      .merge({
        ttl: 100,
        gracePeriod: { enabled: true, duration: '10m' },
      })
      .create()

    // init first value
    const r1 = await cache.getOrSet('key1', () => ({ foo: 'bar' }))

    // wait for expiration
    await setTimeout(100)

    // get the value again
    const r2 = await cache.getOrSet('key1', () => {
      // Since key1 is logically expired, this factory should be called
      assert.incrementAssertionsCount()
      throw new Error('foo')
    })

    assert.deepEqual(r1, { foo: 'bar' })
    assert.deepEqual(r2, { foo: 'bar' })
  })

  test('grace period should not returns old value if cb doesnt throws', async ({ assert }) => {
    const { cache } = new CacheFactory()
      .withL1L2Config()
      .merge({ gracePeriod: { enabled: true, duration: '10m' } })
      .create()

    const r1 = await cache.getOrSet('key1', () => ({ foo: 'bar' }), { ttl: '10ms' })
    await setTimeout(100)

    const r2 = await cache.getOrSet('key1', () => ({ foo: 'baz' }), { ttl: '10ms' })

    assert.deepEqual(r1, { foo: 'bar' })
    assert.deepEqual(r2, { foo: 'baz' })
  })

  test('should throws if graced value is outdated', async ({ assert }) => {
    const { cache } = new CacheFactory()
      .merge({ gracePeriod: { enabled: true, duration: '100ms' } })
      .withL1L2Config()
      .create()

    // init factory
    const r1 = await cache.getOrSet('key1', () => ({ foo: 'bar' }), { ttl: '10ms' })

    // re-get with throwing factory. still in grace period
    const r2 = await cache.getOrSet('key1', throwingFactory('should not be called'), {
      ttl: '10ms',
    })
    await setTimeout(101)

    // re-get with throwing factory. out of grace period. should throws
    const r3 = cache.getOrSet('key1', throwingFactory('error in factory'), { ttl: '10ms' })

    assert.deepEqual(r1, { foo: 'bar' })
    assert.deepEqual(r2, { foo: 'bar' })
    await assert.rejects(() => r3, /error in factory/)
  })

  test('should use the default graced duration when not defined', async ({ assert }) => {
    const { cache } = new CacheFactory()
      .withL1L2Config()
      .merge({ gracePeriod: { enabled: true, duration: '100ms', fallbackDuration: 0 } })
      .create()

    await cache.getOrSet('key1', () => ({ foo: 'bar' }), { ttl: '10ms' })
    await setTimeout(50)

    const r1 = await cache.getOrSet('key1', throwingFactory(), { ttl: '10ms' })

    await setTimeout(50)
    const r2 = cache.getOrSet('key1', throwingFactory('fail'), { ttl: '10ms' })

    assert.deepEqual(r1, { foo: 'bar' })
    await assert.rejects(() => r2, /fail/)
  })

  test('early expiration', async ({ assert }) => {
    assert.plan(5)

    const { cache } = new CacheFactory()
      .withL1L2Config()
      .merge({ earlyExpiration: 0.5, ttl: 100 })
      .create()

    // Call factory
    const r1 = await cache.getOrSet('key1', () => ({ foo: 'bar' }))

    // wait until early refresh should be done
    await setTimeout(51)

    // Call factory again. Should call factory for early refresh since we waited
    // 51ms and early expiration is 50% of ttl ( so 50ms )
    const r2 = await cache.getOrSet('key1', async () => {
      await setTimeout(50)
      assert.isTrue(true)
      return { foo: 'baz' }
    })

    // This factory should return the first cached value since early refresh is
    // still running
    const r3 = await cache.getOrSet('key1', () => ({ foo: 'bazzz' }))

    await setTimeout(50)

    // This factory should return the second cached value since early refresh is
    // now done
    const r4 = await cache.getOrSet('key1', () => ({ foo: 'bazzzz' }))

    assert.deepEqual(r1, { foo: 'bar' })
    assert.deepEqual(r2, { foo: 'bar' })
    assert.deepEqual(r3, { foo: 'bar' })
    assert.deepEqual(r4, { foo: 'baz' })
  })

  test('early refresh should be locked. only one factory call', async ({ assert }) => {
    assert.plan(4)

    const { cache } = new CacheFactory()
      .merge({ earlyExpiration: 0.5, ttl: 100 })
      .withL1L2Config()
      .create()

    // Init cache with a value
    await cache.getOrSet('key1', () => ({ foo: 'bar' }))
    await setTimeout(51)

    // Two concurrent calls. Only one factory call should be invoked
    const factory = async () => {
      assert.isTrue(true)
      await setTimeout(50)
      return { foo: 'baz' }
    }

    const [r1, r2] = await Promise.all([
      cache.getOrSet('key1', factory),
      cache.getOrSet('key1', factory),
    ])

    // Refresh is done. should have the new value
    await setTimeout(51)
    const r3 = await cache.getOrSet('key1', () => ({ foo: 'bazzz' }))

    assert.deepEqual(r1, { foo: 'bar' })
    assert.deepEqual(r2, { foo: 'bar' })
    assert.deepEqual(r3, { foo: 'baz' })
  })

  test('earlyexpiration of >= 0 or <= 1 should be ignored', async ({ assert }) => {
    const { cache, local, stack } = new CacheFactory().withL1L2Config().merge({ ttl: 100 }).create()

    await cache.getOrSet('key1', () => ({ foo: 'bar' }), { earlyExpiration: 1 })
    await cache.getOrSet('key2', () => ({ foo: 'bar' }), { earlyExpiration: 0 })

    const r1 = local.get('key1', stack.defaultOptions)
    const r2 = local.get('key2', stack.defaultOptions)

    assert.isUndefined(r1?.getEarlyExpiration())
    assert.isUndefined(r2?.getEarlyExpiration())
  })

  test('early refresh should re-increment physical/logical ttls', async ({ assert }) => {
    const { cache } = new CacheFactory()
      .merge({ earlyExpiration: 0.5, ttl: 100 })
      .withL1L2Config()
      .create()

    // init cache
    const r1 = await cache.getOrSet('key1', () => ({ foo: 'bar' }))

    // wait for early refresh threshold
    await setTimeout(60)

    // call factory. should returns the old value.
    // Disable early expiration to test physical ttl
    const r2 = await cache.getOrSet('key1', slowFactory(50, { foo: 'baz' }), {
      earlyExpiration: undefined,
    })

    // wait for early refresh to be done
    await setTimeout(50)

    // get the value
    const r3 = await cache.get('key1')

    // wait a bit
    await setTimeout(50)
    const r4 = await cache.get('key1')

    // wait for physical ttl to expire
    await setTimeout(50)
    const r5 = await cache.get('key1')

    assert.deepEqual(r1, { foo: 'bar' })
    assert.deepEqual(r2, { foo: 'bar' })
    assert.deepEqual(r3, { foo: 'baz' })
    assert.deepEqual(r4, { foo: 'baz' })
    assert.isUndefined(r5)
  })

  test('rethrows error when suppressL2Errors is false', async ({ assert }) => {
    const remoteDriver = new ChaosCache(new RedisDriver({ connection: REDIS_CREDENTIALS }))

    const { cache } = new CacheFactory()
      .merge({ l2Driver: remoteDriver, gracePeriod: { enabled: true, duration: '2h' } })
      .withL1L2Config()
      .create()

    // init cache
    await cache.getOrSet('key1', () => ({ foo: 'bar' }), { ttl: '100ms' })

    // make the remote cache fail
    remoteDriver.alwaysThrow()

    // wait till we enter the grace period
    await setTimeout(100)

    // get the value again
    const r2 = cache.getOrSet('key1', () => ({ foo: 'baz' }), {
      suppressL2Errors: false,
    })

    await assert.rejects(() => r2, 'Chaos: Random error')
  }).skip()

  test('set() set item in local and remote store', async ({ assert }) => {
    const { cache, local, remote, stack } = new CacheFactory().withL1L2Config().create()

    await cache.set('foo', 'bar')

    const r1 = local.get('foo', stack.defaultOptions)
    const r2 = await remote.get('foo', stack.defaultOptions)

    assert.deepEqual(r1!.getValue(), 'bar')
    assert.deepEqual(r2!.getValue(), 'bar')
  })

  test('set should use default CacheOptions', async ({ assert }) => {
    const { cache, local, remote, stack } = new CacheFactory()
      .withL1L2Config()
      .merge({ earlyExpiration: 0.5, ttl: 60 * 1000 })
      .create()

    await cache.set('foo', 'bar')

    const r1 = local.get('foo', stack.defaultOptions)
    const r2 = await remote.get('foo', stack.defaultOptions)

    const earlyExpiration = Date.now() + 30 * 1000

    assert.closeTo(r1!.getEarlyExpiration(), earlyExpiration, 100)
    assert.closeTo(r2!.getEarlyExpiration(), earlyExpiration, 100)
  })

  test('could override default CacheOptions', async ({ assert }) => {
    const { cache, local, remote, stack } = new CacheFactory()
      .withL1L2Config()
      .merge({ earlyExpiration: 0.5, ttl: 60 * 1000 })
      .create()

    await cache.set('foo', 'bar', { earlyExpiration: 0.25 })

    const r1 = local.get('foo', stack.defaultOptions)
    const r2 = await remote.get('foo', stack.defaultOptions)

    const earlyExpiration = Date.now() + 15 * 1000

    assert.closeTo(r1!.getEarlyExpiration(), earlyExpiration, 100)
    assert.closeTo(r2!.getEarlyExpiration(), earlyExpiration, 100)
  })

  test('set should expires others local cache', async ({ assert }) => {
    const [cache1, local1, , stack] = new CacheFactory().withL1L2Config().create()
    const [cache2] = new CacheFactory().withL1L2Config().create()

    // first we initialize the cache with a value
    await cache1.set('foo', 'bar')

    // then we update it from another cache
    await cache2.set('foo', 'baz')

    await setTimeout(100)

    // so local cache of cache1 should be invalidated
    const r1 = local1.get('foo', stack.defaultOptions)

    // a get should return the new value
    const r2 = await cache1.get('foo')

    await setTimeout(100)

    assert.isDefined(r1)
    assert.isBelow(r1!.getLogicalExpiration(), Date.now())
    assert.equal(r2, 'baz')
  })

  test('deleteMany should delete from local and remote', async ({ assert }) => {
    const { cache, local, remote, stack } = new CacheFactory().withL1L2Config().create()

    await cache.set('foo', 'bar')
    await cache.set('bar', 'baz')

    // then we delete it
    await cache.deleteMany(['foo', 'bar'])

    // so local cache should be deleted
    const r1 = local.get('foo', stack.defaultOptions)
    const r2 = local.get('bar', stack.defaultOptions)

    // and remote cache should be deleted
    const r3 = await remote.get('foo', stack.defaultOptions)
    const r4 = await remote.get('bar', stack.defaultOptions)

    assert.isUndefined(r1)
    assert.isUndefined(r2)
    assert.isUndefined(r3)
    assert.isUndefined(r4)
  })

  test('deleteMany should throw if remote fail and suppressL2Errors is on', async ({ assert }) => {
    const remoteDriver = new ChaosCache(new RedisDriver({ connection: REDIS_CREDENTIALS }))
    const { cache, local, stack } = new CacheFactory()
      .merge({ l2Driver: remoteDriver })
      .withL1L2Config()
      .create()

    await cache.set('foo', 'bar')
    await cache.set('bar', 'baz')

    remoteDriver.alwaysThrow()
    const r1 = cache.deleteMany(['foo', 'bar'], { suppressL2Errors: false })

    await assert.rejects(() => r1, 'Chaos: Random error')

    const r2 = local.get('foo', stack.defaultOptions)
    const r3 = local.get('bar', stack.defaultOptions)

    assert.isUndefined(r2)
    assert.isUndefined(r3)
  })

  test('a deleteMany should delete others instances local caches', async ({ assert }) => {
    const [cache1, local1, , stack] = new CacheFactory().withL1L2Config().create()
    const [cache2] = new CacheFactory().withL1L2Config().create()

    // first we initialize the cache1 with some keys
    await cache1.set('foo', 'bar')
    await cache1.set('bar', 'baz')

    // then we delete it from another cache
    await cache2.deleteMany(['foo', 'bar'])

    await setTimeout(100)

    // so local cache of cache1 should be invalidated
    const r1 = local1.get('foo', stack.defaultOptions)
    const r2 = local1.get('bar', stack.defaultOptions)

    assert.isUndefined(r1)
    assert.isUndefined(r2)
  })

  test('a deleteMany should delete others local cache even if remote fail', async ({ assert }) => {
    const remoteDriver = new ChaosCache(new RedisDriver({ connection: REDIS_CREDENTIALS }))

    const [cache1, local1, , stack] = new CacheFactory()
      .merge({ l2Driver: remoteDriver })
      .withL1L2Config()
      .create()
    const [cache2] = new CacheFactory().merge({ l2Driver: remoteDriver }).withL1L2Config().create()

    // first we initialize the cache1 with some keys
    await cache1.set('foo', 'bar')
    await cache1.set('bar', 'baz')
    await cache1.set('baz', 'foo')

    // then we delete it from another cache. remote will throw
    remoteDriver.alwaysThrow()
    await cache2.deleteMany(['foo', 'bar'])

    await setTimeout(100)

    // so local cache of cache1 should be invalidated
    const r1 = local1.get('foo', stack.defaultOptions)
    const r2 = local1.get('bar', stack.defaultOptions)
    const r3 = local1.get('baz', stack.defaultOptions)

    assert.isUndefined(r1)
    assert.isUndefined(r2)

    // `baz` wasn't deleted
    assert.isDefined(r3)
  })

  test('delete should delete from local and remote', async ({ assert }) => {
    const { cache, local, remote, stack } = new CacheFactory().withL1L2Config().create()

    // first we initialize the cache with a value
    await cache.set('foo', 'bar')

    // then we delete it
    await cache.delete('foo')

    // so local cache should be deleted
    const r1 = local.get('foo', stack.defaultOptions)

    // and remote cache should be deleted
    const r2 = await remote.get('foo', stack.defaultOptions)

    assert.isUndefined(r1)
    assert.isUndefined(r2)
  })

  test('delete should throw if remote fail and suppressL2Errors is on', async ({ assert }) => {
    const remoteDriver = new ChaosCache(new RedisDriver({ connection: REDIS_CREDENTIALS }))

    const { cache, local, stack } = new CacheFactory()
      .merge({ l2Driver: remoteDriver })
      .withL1L2Config()
      .create()

    // first we initialize the cache with a value
    await cache.set('foo', 'bar')

    // then we delete it and disable suppressL2Errors so this method will throw
    remoteDriver.alwaysThrow()
    const r1 = cache.delete('foo', { suppressL2Errors: false })

    await assert.rejects(() => r1, 'Chaos: Random error')

    // but local cache should be deleted
    const r2 = local.get('foo', stack.defaultOptions)

    assert.isUndefined(r2)
  })

  test('a delete should delete others local cache', async ({ assert }) => {
    const [cache1, local1, , stack] = new CacheFactory().withL1L2Config().create()
    const [cache2] = new CacheFactory().withL1L2Config().create()

    // first we initialize the cache1 with a value
    await cache1.set('foo', 'bar')

    // then we delete it from another cache
    await cache2.delete('foo')

    await setTimeout(100)

    // so local cache of cache1 should be invalidated
    const r1 = local1.get('foo', stack.defaultOptions)

    // a get should return the new value
    const r2 = await cache1.get('foo')

    assert.isUndefined(r1)
    assert.isUndefined(r2)
  })

  test('a delete should delete others local cache even if remote fail', async ({ assert }) => {
    const remoteDriver = new ChaosCache(new RedisDriver({ connection: REDIS_CREDENTIALS }))

    const [cache1, local1, , stack] = new CacheFactory()
      .merge({ l2Driver: remoteDriver })
      .withL1L2Config()
      .create()
    const [cache2] = new CacheFactory().merge({ l2Driver: remoteDriver }).withL1L2Config().create()

    // first we initialize the cache1 with a value
    await cache1.set('foo', 'bar')

    // then we delete it from another cache. remote will throw
    remoteDriver.alwaysThrow()
    await cache2.delete('foo')

    await setTimeout(100)

    // so local cache of cache1 should be invalidated
    const r1 = local1.get('foo', stack.defaultOptions)

    const r2 = await cache1.get('foo')
    remoteDriver.neverThrow()

    assert.isUndefined(r1)
    assert.isUndefined(r2)
  })

  test('when a node receive a set/delete event from bus it shouldnt publish a set/delete in return', async ({
    assert,
  }) => {
    class Bus extends MemoryBus {
      published: any[] = []
      async publish(channel: string, message: any) {
        this.published.push({ message })
        return super.publish(channel, message)
      }
    }

    const bus1 = new Bus()
    const [cache1] = new CacheFactory().merge({ busDriver: bus1 }).withL1L2Config().create()

    const bus2 = new Bus()
    const [cache2] = new CacheFactory().merge({ busDriver: bus2 }).withL1L2Config().create()

    await cache1.set('foo', 'bar')
    const r1 = await cache2.get('foo')

    // cache2 should receive the set event but not broadcast a `delete` event
    assert.equal(r1, 'bar')
    assert.isTrue(bus1.published.length === 1)
    assert.isTrue(bus2.published.length === 0)
  })

  test('if only grace perioded item is found in the remote cache it should be returned', async ({
    assert,
  }) => {
    const { cache, remote, stack } = new CacheFactory()
      .merge({ gracePeriod: { enabled: true, duration: '10m' } })
      .withL1L2Config()
      .create()

    remote.set(
      'foo',
      JSON.stringify({ value: 'bar', logicalExpiration: Date.now() - 1000 }),
      stack.defaultOptions,
    )

    const r1 = await cache.get('foo')
    assert.deepEqual(r1, 'bar')
  })

  test('if only grace perioded item is found in the local cache it should be returned with getOrSet', async ({
    assert,
  }) => {
    const { cache, remote, stack } = new CacheFactory()
      .merge({ gracePeriod: { enabled: true, duration: '10m' } })
      .withL1L2Config()
      .create()

    remote.set(
      'foo',
      JSON.stringify({ value: 'bar', logicalExpiration: Date.now() - 1000 }),
      stack.defaultOptions,
    )

    const r1 = await cache.getOrSet('foo', throwingFactory('error in factory'), { ttl: '10ms' })
    assert.deepEqual(r1, 'bar')
  })

  test('namespaces should work', async ({ assert }) => {
    const { cache, local, remote, stack } = new CacheFactory().withL1L2Config().create()

    const users = cache.namespace('users')
    await users.set('foo', 'bar')

    const r1 = await users.get('foo')
    const r2 = await cache.get('users:foo')
    const r3 = await cache.get('foo')
    const r4 = local.get('users:foo', stack.defaultOptions)
    const r5 = await remote.get('users:foo', stack.defaultOptions)

    assert.deepEqual(r1, 'bar')
    assert.deepEqual(r2, 'bar')
    assert.isUndefined(r3)
    assert.deepEqual(r4?.getValue(), 'bar')
    assert.deepEqual(r5?.getValue(), 'bar')
  })

  test('Bus shouldnt receive messages emitted by itself', async ({ assert }) => {
    const { cache, local, stack } = new CacheFactory().withL1L2Config().create()

    const r1 = await cache.getOrSet('foo', () => ({ foo: 'bar' }))

    // Should still be in local cache and not invalidated by the bus
    const r2 = local.get('foo', stack.defaultOptions)

    assert.deepEqual(r1, { foo: 'bar' })
    assert.deepEqual(r2?.getValue(), { foo: 'bar' })
  })

  test('error in factory while early refreshing should be logged', async ({ assert }) => {
    const logger = new TestLogger()

    process.on('unhandledRejection', () => {})

    const { cache } = new CacheFactory()
      .merge({ earlyExpiration: 0.5, logger })
      .withL1L2Config()
      .create()

    await cache.getOrSet('key1', () => ({ foo: 'bar' }), { ttl: '1s' })

    await setTimeout(501)

    await cache.getOrSet(
      'key1',
      async () => {
        await setTimeout(100)
        throw new Error('foo')
      },
      { ttl: '1s' },
    )

    await setTimeout(110)
    const errorLog = logger.logs.find(
      (log) => log.level === 'error' && log.msg === 'factory error in early refresh',
    )
    assert.isDefined(errorLog)

    process.removeAllListeners('unhandledRejection')
  })

  test('when local and remote hitted items are logically it should prioritize remote', async ({
    assert,
  }) => {
    const { cache, local, remote, stack } = new CacheFactory()
      .merge({ gracePeriod: { enabled: true, duration: '6h' } })
      .withL1L2Config()
      .create()

    local.set(
      'foo',
      JSON.stringify({ value: 'bar', logicalExpiration: Date.now() - 1000 }),
      stack.defaultOptions,
    )
    await remote.set(
      'foo',
      JSON.stringify({ value: 'baz', logicalExpiration: Date.now() - 1000 }),
      stack.defaultOptions,
    )

    const r1 = await cache.getOrSet('foo', throwingFactory('fail'))

    assert.deepEqual(r1, 'baz')
  })

  test('clear should clear local of all instances', async ({ assert }) => {
    const [cache1, local1, , stack] = new CacheFactory().withL1L2Config().create()
    const [cache2, local2] = new CacheFactory().withL1L2Config().create()

    // init cache1 with a value
    await cache1.set('foo', 'bar')

    // init cache2 l1 with the same value
    await cache2.get('foo')

    // clear cache1
    await cache1.clear()

    // cache1 l1 should be cleared
    const r1 = local1.get('foo', stack.defaultOptions)

    // cache2 l1 should be cleared
    const r2 = local2.get('foo', stack.defaultOptions)

    assert.isUndefined(r1)
    assert.isUndefined(r2)
  })
})
