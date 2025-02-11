import { test } from '@japa/runner'
import { sleep } from '@julr/utils/misc'
import { MemoryTransport } from '@boringnode/bus/transports/memory'

import { RedisDriver } from '../../src/drivers/redis.js'
import { UndefinedValueError } from '../../src/errors.js'
import { NullDriver } from '../helpers/null/null_driver.js'
import { ChaosCache } from '../helpers/chaos/chaos_cache.js'
import { CacheFactory } from '../../factories/cache_factory.js'
import { throwingFactory, slowFactory, REDIS_CREDENTIALS } from '../helpers/index.js'

test.group('Cache', () => {
  test('get() returns null if null is stored', async ({ assert }) => {
    const { cache } = new CacheFactory().withL1L2Config().create()

    await cache.set({ key: 'foo', value: null })
    const value = await cache.get({ key: 'foo' })

    assert.isNull(value)
  })

  test('getOrSet returns null if null is stored', async ({ assert }) => {
    const { cache } = new CacheFactory().withL1L2Config().create()

    await cache.set({ key: 'foo', value: null })
    const value = await cache.getOrSet({
      key: 'foo',
      factory: throwingFactory('should not be called'),
    })

    assert.isNull(value)
  })

  test('value not in local but in remote should be returned', async ({ assert }) => {
    const { cache, stack, remote } = new CacheFactory().withL1L2Config().create()

    await remote.set('foo', JSON.stringify({ value: 'bar' }), stack.defaultOptions)

    const value = await cache.get({ key: 'foo' })
    assert.deepEqual(value, 'bar')
  })

  test('value not in local and not in remote should returns undefined', async ({ assert }) => {
    const { cache } = new CacheFactory().withL1L2Config().create()
    const value = await cache.get({ key: 'foo' })

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
    const r1 = await cache.get({ key: 'foo' })

    assert.deepEqual(r1, 'bar')
  })

  test('return remote item if logically expired and grace is enabled', async ({ assert }) => {
    const { cache, remote, stack } = new CacheFactory()
      .withL1L2Config()
      .merge({ grace: '10m' })
      .create()

    await remote.set(
      'foo',
      JSON.stringify({ value: 'bar', logicalExpiration: Date.now() - 1000 }),
      stack.defaultOptions,
    )
    const r1 = await cache.get({ key: 'foo' })

    assert.deepEqual(r1, 'bar')
  })

  test('doesnt return remote item if logically expired and grace is disabled', async ({
    assert,
  }) => {
    const { cache, remote, stack } = new CacheFactory()
      .withL1L2Config()
      .merge({ grace: false })
      .create()

    await remote.set(
      'foo',
      JSON.stringify({ value: 'bar', logicalExpiration: Date.now() - 1000 }),
      stack.defaultOptions,
    )
    const value = await cache.get({ key: 'foo' })

    assert.isUndefined(value)
  })

  test('return local item if logically expired and grace is enabled', async ({ assert }) => {
    const { cache, local, stack } = new CacheFactory()
      .withL1L2Config()
      .merge({ grace: '10m' })
      .create()

    local.set(
      'foo',
      JSON.stringify({ value: 'bar', logicalExpiration: Date.now() - 1000 }),
      stack.defaultOptions,
    )
    const value = await cache.get({ key: 'foo' })

    assert.deepEqual(value, 'bar')
  })

  test('doesnt return local item if logically expired and grace is disabled', async ({
    assert,
  }) => {
    const { cache, local, stack } = new CacheFactory()
      .withL1L2Config()
      .merge({ grace: false })
      .create()

    local.set(
      'foo',
      JSON.stringify({ value: 'bar', logicalExpiration: Date.now() - 1000 }),
      stack.defaultOptions,
    )
    const value = await cache.get({ key: 'foo' })

    assert.isUndefined(value)
  })

  test('set item to local store if found in remote', async ({ assert }) => {
    const { cache, local, remote, stack } = new CacheFactory().withL1L2Config().create()

    await remote.set('foo', JSON.stringify({ value: 'bar' }), stack.defaultOptions)
    await cache.get({ key: 'foo' })

    const value = local.get('foo', stack.defaultOptions)
    assert.deepEqual(value?.entry.getValue(), 'bar')
  })

  test('return default value if item not found in local and remote', async ({ assert }) => {
    const { cache } = new CacheFactory().withL1L2Config().create()

    const value = await cache.get({ key: 'foo', defaultValue: 'bar' })
    assert.deepEqual(value, 'bar')
  })

  test('returns value when key exists in local', async ({ assert }) => {
    const { cache, local, stack } = new CacheFactory().withL1L2Config().create()

    local.set('key1', JSON.stringify({ value: 'bar' }), stack.defaultOptions)
    const value = await cache.getOrSet({
      key: 'key1',
      factory: throwingFactory('should not be called'),
    })

    assert.deepEqual(value, 'bar')
  })

  test('returns value when key exists in remote', async ({ assert }) => {
    const { cache, remote, stack } = new CacheFactory().withL1L2Config().create()

    await remote.set('key1', JSON.stringify({ value: 'bar' }), stack.defaultOptions)
    const value = await cache.getOrSet({
      key: 'key1',
      factory: throwingFactory('should not be called'),
    })

    assert.deepEqual(value, 'bar')
  })

  test('set value in local when key does not exist in local but exists in remote', async ({
    assert,
  }) => {
    const { cache, local, remote, stack } = new CacheFactory().withL1L2Config().create()

    await remote.set('key1', JSON.stringify({ value: 'bar' }), stack.defaultOptions)
    const value = await cache.getOrSet({
      key: 'key1',
      factory: throwingFactory('should not be called'),
    })
    const localeValue = local.get('key1', stack.defaultOptions)

    assert.deepEqual(value, 'bar')
    assert.deepEqual(localeValue?.entry.getValue(), 'bar')
  })

  test('store values in both when key does not exists in local and remote', async ({ assert }) => {
    const { cache, local, remote, stack } = new CacheFactory().withL1L2Config().create()

    const value = await cache.getOrSet({ key: 'key1', factory: slowFactory(40, 'bar') })

    const localeValue = local.get('key1', stack.defaultOptions)
    const remoteValue = await remote.get('key1', stack.defaultOptions)

    assert.deepEqual(value, 'bar')
    assert.deepEqual(localeValue!.entry.getValue(), 'bar')
    assert.deepEqual(remoteValue!.entry.getValue(), 'bar')
  })

  test('with specific ttl', async ({ assert }) => {
    const { cache, local, remote, stack } = new CacheFactory().withL1L2Config().create()

    await cache.getOrSet({
      key: 'key1',
      factory: () => ({ foo: 'bar' }),
      ttl: '10ms',
    })

    await sleep(20)

    assert.isUndefined(await cache.get({ key: 'key1' }))
    assert.isUndefined(local.get('key1', stack.defaultOptions))
    assert.isUndefined(await remote.get('key1', stack.defaultOptions))
  })

  test('should returns old value if factory throws and grace enabled', async ({ assert }) => {
    assert.plan(3)

    const { cache } = new CacheFactory()
      .withL1L2Config()
      .merge({ ttl: 100, grace: '10m', timeout: null })
      .create()

    // init first value
    const r1 = await cache.getOrSet({ key: 'key1', factory: () => ({ foo: 'bar' }) })

    // wait for expiration
    await sleep(100)

    // get the value again
    const r2 = await cache.getOrSet({
      key: 'key1',
      factory: () => {
        // Since key1 is logically expired, this factory should be called
        assert.incrementAssertionsCount()
        throw new Error('foo')
      },
    })

    assert.deepEqual(r1, { foo: 'bar' })
    assert.deepEqual(r2, { foo: 'bar' })
  })

  test('grace period should not returns old value if cb doesnt throws and soft timeout allows it', async ({
    assert,
  }) => {
    const { cache } = new CacheFactory()
      .withL1L2Config()
      .merge({ grace: '10m', timeout: '2s' })
      .create()

    const r1 = await cache.getOrSet({ key: 'key1', ttl: '10ms', factory: () => ({ foo: 'bar' }) })
    await sleep(100)

    const r2 = await cache.getOrSet({ key: 'key1', ttl: '10ms', factory: () => ({ foo: 'baz' }) })

    assert.deepEqual(r1, { foo: 'bar' })
    assert.deepEqual(r2, { foo: 'baz' })
  })

  test('should throws if graced value is outdated', async ({ assert }) => {
    const { cache } = new CacheFactory().merge({ grace: '400ms' }).withL1L2Config().create()

    // init factory
    const r1 = await cache.getOrSet({
      key: 'key1',
      ttl: '10ms',
      factory: () => ({ foo: 'bar' }),
    })

    // re-get with throwing factory. still in grace period
    const r2 = await cache.getOrSet({
      key: 'key1',
      ttl: '10ms',
      factory: throwingFactory('error in factory'),
    })

    await sleep(500)

    // re-get with throwing factory. out of grace period. should throws
    const r3 = cache.getOrSet({
      key: 'key1',
      ttl: '10ms',
      factory: throwingFactory('error in factory'),
    })

    assert.deepEqual(r1, { foo: 'bar' })
    assert.deepEqual(r2, { foo: 'bar' })
    await assert.rejects(() => r3, /Factory has thrown an error/)
  })

  test('should use the default graced duration when not defined', async ({ assert }) => {
    const { cache, local, stack } = new CacheFactory()
      .withL1L2Config()
      .merge({ grace: '2s' })
      .create()

    await cache.getOrSet({ key: 'key1', ttl: '10ms', factory: () => ({ foo: 'bar' }) })

    await sleep(100)

    const entry = local.get('key1', stack.defaultOptions)
    assert.deepEqual(entry?.isGraced, true)

    await sleep(2000)

    const entry2 = local.get('key1', stack.defaultOptions)
    assert.isUndefined(entry2)
  }).disableTimeout()

  test('rethrows error when suppressL2Errors is false', async ({ assert }) => {
    const remoteDriver = new ChaosCache(new RedisDriver({ connection: REDIS_CREDENTIALS }))

    const { cache } = new CacheFactory()
      .merge({ l2Driver: remoteDriver, grace: '2h' })
      .withL1L2Config()
      .create()

    // init cache
    await cache.getOrSet({ key: 'key1', ttl: '100ms', factory: () => ({ foo: 'bar' }) })

    // make the remote cache fail
    remoteDriver.alwaysThrow()

    // wait till we enter the grace period
    await sleep(100)

    // get the value again
    const r2 = cache.getOrSet({
      key: 'key1',
      factory: () => ({ foo: 'baz' }),
      suppressL2Errors: false,
    })

    await assert.rejects(() => r2, 'Chaos: Random error')
  }).skip()

  test('set() set item in local and remote store', async ({ assert }) => {
    const { cache, local, remote, stack } = new CacheFactory().withL1L2Config().create()

    await cache.set({ key: 'foo', value: 'bar' })

    const r1 = local.get('foo', stack.defaultOptions)
    const r2 = await remote.get('foo', stack.defaultOptions)

    assert.deepEqual(r1!.entry.getValue(), 'bar')
    assert.deepEqual(r2!.entry.getValue(), 'bar')
  })

  test('set should expires others local cache', async ({ assert }) => {
    const [cache1, local1, , stack] = new CacheFactory().withL1L2Config().create()
    const [cache2] = new CacheFactory().withL1L2Config().create()

    // first we initialize the cache with a value
    await cache1.set({ key: 'foo', value: 'bar' })

    // then we update it from another cache
    await cache2.set({ key: 'foo', value: 'baz' })

    await sleep(100)

    // so local cache of cache1 should be invalidated
    const r1 = local1.get('foo', stack.defaultOptions)

    // a get should return the new value
    const r2 = await cache1.get({ key: 'foo' })

    await sleep(100)

    assert.isDefined(r1)
    assert.isBelow(r1!.entry.getLogicalExpiration(), Date.now())
    assert.equal(r2, 'baz')
  })

  test('deleteMany should delete from local and remote', async ({ assert }) => {
    const { cache, local, remote, stack } = new CacheFactory().withL1L2Config().create()

    await cache.set({ key: 'foo', value: 'bar' })
    await cache.set({ key: 'bar', value: 'baz' })

    // then we delete it
    await cache.deleteMany({ keys: ['foo', 'bar'] })

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

    await cache.set({ key: 'foo', value: 'bar' })
    await cache.set({ key: 'bar', value: 'baz' })

    remoteDriver.alwaysThrow()
    const r1 = cache.deleteMany({ keys: ['foo', 'bar'], suppressL2Errors: false })

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
    await cache1.set({ key: 'foo', value: 'bar' })
    await cache1.set({ key: 'bar', value: 'baz' })

    // then we delete it from another cache
    await cache2.deleteMany({ keys: ['foo', 'bar'] })

    await sleep(100)

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
    await cache1.set({ key: 'foo', value: 'bar' })
    await cache1.set({ key: 'bar', value: 'baz' })
    await cache1.set({ key: 'baz', value: 'foo' })

    // then we delete it from another cache. remote will throw
    remoteDriver.alwaysThrow()
    await cache2.deleteMany({ keys: ['foo', 'bar'] })

    await sleep(100)

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
    await cache.set({ key: 'foo', value: 'bar' })

    // then we delete it
    await cache.delete({ key: 'foo' })

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
    await cache.set({ key: 'foo', value: 'bar' })

    // then we delete it and disable suppressL2Errors so this method will throw
    remoteDriver.alwaysThrow()
    const r1 = cache.delete({ key: 'foo', suppressL2Errors: false })

    await assert.rejects(() => r1, 'Chaos: Random error')

    // but local cache should be deleted
    const r2 = local.get('foo', stack.defaultOptions)

    assert.isUndefined(r2)
  })

  test('a delete should delete others local cache', async ({ assert }) => {
    const [cache1, local1, , stack] = new CacheFactory().withL1L2Config().create()
    const [cache2] = new CacheFactory().withL1L2Config().create()

    // first we initialize the cache1 with a value
    await cache1.set({ key: 'foo', value: 'bar' })

    // then we delete it from another cache
    await cache2.delete({ key: 'foo' })

    await sleep(100)

    // so local cache of cache1 should be invalidated
    const r1 = local1.get('foo', stack.defaultOptions)

    // a get should return the new value
    const r2 = await cache1.get({ key: 'foo' })

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
    await cache1.set({ key: 'foo', value: 'bar' })

    // then we delete it from another cache. remote will throw
    remoteDriver.alwaysThrow()
    await cache2.delete({ key: 'foo' })

    await sleep(100)

    // so local cache of cache1 should be invalidated
    const r1 = local1.get('foo', stack.defaultOptions)

    const r2 = await cache1.get({ key: 'foo' })
    remoteDriver.neverThrow()

    assert.isUndefined(r1)
    assert.isUndefined(r2)
  })

  test('when a node receive a set/delete event from bus it shouldnt publish a set/delete in return', async ({
    assert,
  }) => {
    class Bus extends MemoryTransport {
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

    await cache1.set({ key: 'foo', value: 'bar' })
    const r1 = await cache2.get({ key: 'foo' })

    // cache2 should receive the set event but not broadcast a `delete` event
    assert.equal(r1, 'bar')
    assert.isTrue(bus1.published.length === 1)
    assert.isTrue(bus2.published.length === 0)
  })

  test('if only grace perioded item is found in the remote cache it should be returned', async ({
    assert,
  }) => {
    const { cache, remote, stack } = new CacheFactory()
      .merge({ grace: '10m' })
      .withL1L2Config()
      .create()

    remote.set(
      'foo',
      JSON.stringify({ value: 'bar', logicalExpiration: Date.now() - 1000 }),
      stack.defaultOptions,
    )

    const r1 = await cache.get({ key: 'foo' })
    assert.deepEqual(r1, 'bar')
  })

  test('if only grace perioded item is found in the local cache it should be returned with getOrSet', async ({
    assert,
  }) => {
    const { cache, remote, stack } = new CacheFactory()
      .merge({ grace: '10m' })
      .withL1L2Config()
      .create()

    remote.set(
      'foo',
      JSON.stringify({ value: 'bar', logicalExpiration: Date.now() - 1000 }),
      stack.defaultOptions,
    )

    const r1 = await cache.getOrSet({
      key: 'foo',
      ttl: '10ms',
      factory: throwingFactory('error in factory'),
    })
    assert.deepEqual(r1, 'bar')
  })

  test('namespaces should work', async ({ assert }) => {
    const { cache, local, remote, stack } = new CacheFactory().withL1L2Config().create()

    const users = cache.namespace('users')
    await users.set({ key: 'foo', value: 'bar' })

    const r1 = await users.get({ key: 'foo' })
    const r2 = await cache.get({ key: 'users:foo' })
    const r3 = await cache.get({ key: 'foo' })
    const r4 = local.get('users:foo', stack.defaultOptions)
    const r5 = await remote.get('users:foo', stack.defaultOptions)

    assert.deepEqual(r1, 'bar')
    assert.deepEqual(r2, 'bar')
    assert.isUndefined(r3)
    assert.deepEqual(r4?.entry.getValue(), 'bar')
    assert.deepEqual(r5?.entry.getValue(), 'bar')
  })

  test('Bus shouldnt receive messages emitted by itself', async ({ assert }) => {
    const { cache, local, stack } = new CacheFactory().withL1L2Config().create()

    const r1 = await cache.getOrSet({ key: 'foo', factory: () => ({ foo: 'bar' }) })

    // Should still be in local cache and not invalidated by the bus
    const r2 = local.get('foo', stack.defaultOptions)

    assert.deepEqual(r1, { foo: 'bar' })
    assert.deepEqual(r2?.entry.getValue(), { foo: 'bar' })
  })

  test('when local and remote hitted items are logically it should prioritize remote', async ({
    assert,
  }) => {
    const { cache, local, remote, stack } = new CacheFactory()
      .merge({ grace: '6h' })
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

    const r1 = await cache.getOrSet({ key: 'foo', factory: throwingFactory('fail') })

    assert.deepEqual(r1, 'baz')
  })

  test('clear should clear local of all instances', async ({ assert }) => {
    const [cache1, local1, , stack] = new CacheFactory().withL1L2Config().create()
    const [cache2, local2] = new CacheFactory().withL1L2Config().create()

    // init cache1 with a value
    await cache1.set({ key: 'foo', value: 'bar' })

    // init cache2 l1 with the same value
    await cache2.get({ key: 'foo' })

    // clear cache1
    await cache1.clear()

    // cache1 l1 should be cleared
    const r1 = local1.get('foo', stack.defaultOptions)

    // cache2 l1 should be cleared
    const r2 = local2.get('foo', stack.defaultOptions)

    assert.isUndefined(r1)
    assert.isUndefined(r2)
  })

  test('should throw if undefined is about to bet set', async ({ assert }) => {
    const { cache } = new CacheFactory().withL1L2Config().create()

    try {
      await cache.set({ key: 'foo', value: undefined })
    } catch (error) {
      assert.instanceOf(error, UndefinedValueError)
    }
  })
})
