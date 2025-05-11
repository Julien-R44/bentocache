import { test } from '@japa/runner'
import { sleep } from '@julr/utils/misc'

import { CacheFactory } from '../../factories/cache_factory.js'
import { throwingFactory, slowFactory } from '../helpers/index.js'

test.group('One tier tests', () => {
  test('get() returns deserialized value', async ({ assert }) => {
    const { cache } = new CacheFactory().withMemoryL1().create()

    await cache.set({ key: 'key', value: { foo: 'bar' } })
    assert.deepEqual(await cache.get({ key: 'key' }), { foo: 'bar' })

    await cache.set({ key: 'key', value: ['foo', 'bar'] })
    assert.deepEqual(await cache.get({ key: 'key' }), ['foo', 'bar'])

    await cache.set({ key: 'key', value: 1 })
    assert.deepEqual(await cache.get({ key: 'key' }), 1)

    await cache.set({ key: 'key', value: true })
    assert.deepEqual(await cache.get({ key: 'key' }), true)
  })

  test('get() returns null when null is stored', async ({ assert }) => {
    const { cache } = new CacheFactory().withMemoryL1().create()

    await cache.set({ key: 'key', value: null })
    assert.isNull(await cache.get({ key: 'key' }))
  })

  test('get() with default value fallback', async ({ assert }) => {
    const { cache } = new CacheFactory().withMemoryL1().create()

    const r1 = await cache.get({ key: 'key', defaultValue: 'default' })
    const r2 = await cache.get({ key: 'key', defaultValue: () => 'default' })

    assert.equal(r1, 'default')
    assert.equal(r2, 'default')
  })

  test('get() with fallback but item found should return item', async ({ assert }) => {
    const { cache } = new CacheFactory().withMemoryL1().create()

    await cache.set({ key: 'key', value: 'value' })
    const r1 = await cache.get({ key: 'key', defaultValue: 'default' })

    assert.equal(r1, 'value')
  })

  test('get() with grace period', async ({ assert }) => {
    const { cache } = new CacheFactory().withMemoryL1().merge({ grace: '4h' }).create()

    await cache.set({ key: 'key', value: 'value', ttl: '100ms' })
    await sleep(110)

    const r1 = await cache.get({ key: 'key' })
    const r2 = await cache.get({ key: 'key', defaultValue: undefined, grace: false })

    assert.deepEqual(r1, 'value')
    assert.isUndefined(r2)
  })

  test('get() with grace period and default value but no fallback value', async ({ assert }) => {
    const { cache } = new CacheFactory().withMemoryL1().merge({ grace: '4h' }).create()

    const result = await cache.get({
      key: 'key',
      defaultValue: 'default',
    })

    assert.equal(result, 'default')
  })

  test('get() should not use grace period when disabled', async ({ assert }) => {
    const { cache } = new CacheFactory().withMemoryL1().merge({ grace: false }).create()

    await cache.getOrSet({
      key: 'key',
      ttl: '10ms',
      grace: '500ms',
      factory: () => 'value',
    })

    // we should get value
    const r1 = await cache.get({ key: 'key' })

    // wait til key expires
    await sleep(100)

    // we should not get value since grace period is disabled globally
    const r2 = await cache.get({ key: 'key' })

    // Otherwise if we had enabled grace period, we would get value
    const result = await cache.getOrSet({
      key: 'key',
      ttl: '10ms',
      grace: '500ms',
      factory: throwingFactory('DB call failed'),
    })

    assert.deepEqual(r1, 'value')
    assert.deepEqual(r2, undefined)
    assert.deepEqual(result, 'value')
  })

  test('missing() returns true when key does not exists', async ({ assert }) => {
    const { cache } = new CacheFactory().withMemoryL1().create()
    assert.isTrue(await cache.missing({ key: 'key1' }))
  })

  test('missing() returns false when key exists', async ({ assert }) => {
    const { cache } = new CacheFactory().withMemoryL1().create()

    await cache.set({ key: 'key1', value: 'value1' })
    assert.isFalse(await cache.missing({ key: 'key1' }))
  })

  test('missing() returns true if logically expired', async ({ assert }) => {
    const { cache } = new CacheFactory().withMemoryL1().merge({ grace: '500ms' }).create()

    await cache.set({ key: 'key1', value: 'value1', ttl: '100ms' })

    await sleep(100)
    const r1 = await cache.missing({ key: 'key1' })

    await sleep(500)
    const r2 = await cache.missing({ key: 'key1' })

    assert.isTrue(r1)
    assert.isTrue(r2)
  })

  test('has() returns false when key does not exists', async ({ assert }) => {
    const { cache } = new CacheFactory().withMemoryL1().create()
    assert.isFalse(await cache.has({ key: 'key1' }))
  })

  test('has() returns true when key exists', async ({ assert }) => {
    const { cache } = new CacheFactory().withMemoryL1().create()

    await cache.set({ key: 'key1', value: 'value1' })
    assert.isTrue(await cache.has({ key: 'key1' }))
  })

  test('has() returns false if logically expired', async ({ assert }) => {
    const { cache } = new CacheFactory().withMemoryL1().merge({ grace: '500ms' }).create()

    await cache.set({ key: 'key1', value: 'value1', ttl: '100ms' })
    await sleep(100)

    const r1 = await cache.has({ key: 'key1' })

    await sleep(500)
    const r2 = await cache.has({ key: 'key1' })

    assert.isFalse(r1)
    assert.isFalse(r2)
  })

  test('clear() remove all keys', async ({ assert }) => {
    const { cache } = new CacheFactory().withMemoryL1().create()

    await cache.set({ key: 'key1', value: 'value1', ttl: '100ms' })
    await cache.set({ key: 'key2', value: 'bar' })
    await cache.namespace('users').set({ key: 'key3', value: 'blabla' })

    await cache.clear()

    assert.isFalse(await cache.has({ key: 'key1' }))
    assert.isFalse(await cache.has({ key: 'key2' }))
    assert.isFalse(await cache.namespace('users').has({ key: 'key3' }))
  })

  test('delete should delete key', async ({ assert }) => {
    const { cache } = new CacheFactory().withMemoryL1().merge({ grace: '500ms' }).create()

    await cache.set({ key: 'key1', value: 'value1', ttl: '100ms' })
    await cache.set({ key: 'key2', value: 'bar' })

    await sleep(100)

    await cache.delete({ key: 'key1' })
    await cache.delete({ key: 'key2' })

    assert.isFalse(await cache.has({ key: 'key1' }))
    assert.isFalse(await cache.has({ key: 'key2' }))
  })

  test('deleteMany should delete multiple keys', async ({ assert }) => {
    const { cache } = new CacheFactory().withMemoryL1().merge({ grace: '500ms' }).create()

    await cache.set({ key: 'key1', value: 'value1', ttl: '100ms' })
    await cache.set({ key: 'key2', value: 'bar' })

    await sleep(100)

    await cache.deleteMany({ keys: ['key1', 'key2'] })

    assert.isFalse(await cache.has({ key: 'key1' }))
    assert.isFalse(await cache.has({ key: 'key2' }))
  })

  test('getOrSet() should returns null if null is stored', async ({ assert }) => {
    const { cache } = new CacheFactory().withMemoryL1().create()

    await cache.set({ key: 'key', value: null })

    const value = await cache.getOrSet({
      key: 'key',
      factory: throwingFactory('shouldnt be called'),
    })
    assert.isNull(value)
  })

  test('getOrSetForever() should set value forever', async ({ assert }) => {
    const { cache } = new CacheFactory().withMemoryL1().merge({ ttl: 100 }).create()

    await cache.getOrSetForever({ key: 'key', factory: () => 'value' })
    assert.deepEqual(await cache.get({ key: 'key' }), 'value')

    await sleep(100)

    assert.deepEqual(await cache.get({ key: 'key' }), 'value')
  })

  test('getOrSetForever() returns value when key exists', async ({ assert }) => {
    const { cache } = new CacheFactory().withMemoryL1().create()

    await cache.set({ key: 'key1', value: { foo: 'bar' } })
    const r1 = await cache.getOrSetForever({
      key: 'key1',
      factory: throwingFactory('shouldnt be called'),
    })

    assert.deepEqual(r1, { foo: 'bar' })
  })

  test('getOrSetForever() store values when key does not exists', async ({ assert }) => {
    const { cache } = new CacheFactory().withMemoryL1().create()

    const value = await cache.getOrSetForever({ key: 'key1', factory: () => ({ foo: 'bar' }) })
    assert.deepEqual(value, { foo: 'bar' })
    assert.deepEqual(await cache.get({ key: 'key1' }), { foo: 'bar' })
  })

  test('setForever() store a value forever', async ({ assert }) => {
    const { cache } = new CacheFactory().withMemoryL1().merge({ ttl: 10 }).create()

    await cache.setForever({ key: 'key', value: 'value' })
    await sleep(30)
    assert.deepEqual(await cache.get({ key: 'key' }), 'value')
  })

  test('setForever() returns true when value is set', async ({ assert }) => {
    const { cache } = new CacheFactory().withMemoryL1().create()

    const result = await cache.setForever({ key: 'key', value: 'value' })
    assert.isTrue(result)
  })

  test('getOrSet() returns value when key exists', async ({ assert }) => {
    const { cache } = new CacheFactory().withMemoryL1().create()

    await cache.set({ key: 'key1', value: { foo: 'bar' } })
    const value = await cache.getOrSet({ key: 'key1', factory: () => ({ foo: 'baz' }) })

    assert.deepEqual(value, { foo: 'bar' })
  })

  test('getOrSet() returns value when key exists', async ({ assert }) => {
    const { cache } = new CacheFactory().withMemoryL1().create()

    await cache.set({ key: 'key1', value: { foo: 'bar' } })
    const value = await cache.getOrSet({ key: 'key1', factory: () => ({ foo: 'baz' }) })

    assert.deepEqual(value, { foo: 'bar' })
  })

  test('getOrSet() store values when key does not exists', async ({ assert }) => {
    const { cache } = new CacheFactory().withMemoryL1().create()

    const value = await cache.getOrSet({ key: 'key1', factory: () => ({ foo: 'bar' }) })

    assert.deepEqual(value, { foo: 'bar' })
    assert.deepEqual(await cache.get({ key: 'key1' }), { foo: 'bar' })
  })

  test('getOrSet() with specific ttl', async ({ assert }) => {
    const { cache } = new CacheFactory().withMemoryL1().create()

    await cache.getOrSet({ key: 'key1', ttl: '10ms', factory: () => ({ foo: 'bar' }) })
    await sleep(20)

    assert.isUndefined(await cache.get({ key: 'key1' }))
  })

  test('grace period should returns old value if factory throws', async ({ assert }) => {
    assert.plan(3)

    const { cache } = new CacheFactory().withMemoryL1().merge({ ttl: 10, grace: '10m' }).create()

    const result = await cache.getOrSet({ key: 'key1', factory: () => ({ foo: 'bar' }) })

    await sleep(100)
    const result2 = await cache.getOrSet({
      key: 'key1',
      factory: () => {
        // Since key1 is logically expired, this factory should be called
        assert.incrementAssertionsCount()
        throw new Error('foo')
      },
    })

    assert.deepEqual(result, { foo: 'bar' })
    assert.deepEqual(result2, { foo: 'bar' })
  })

  test('grace period should not returns old value if factory doesnt throws and soft timeout allows it', async ({
    assert,
  }) => {
    const { cache } = new CacheFactory()
      .withMemoryL1()
      .merge({ ttl: 10, grace: '10m', timeout: '2s' })
      .create()

    const r1 = await cache.getOrSet({ key: 'key1', factory: () => ({ foo: 'bar' }) })

    await sleep(100)

    const r2 = await cache.getOrSet({ key: 'key1', factory: () => ({ foo: 'baz' }) })

    assert.deepEqual(r1, { foo: 'bar' })
    assert.deepEqual(r2, { foo: 'baz' })
  })

  test('should throws if graced value is now expired', async ({ assert }) => {
    const { cache } = new CacheFactory()
      .withMemoryL1()
      .merge({ ttl: 10, grace: '100ms', timeout: '2s' })
      .create()

    // init cache
    const r1 = await cache.getOrSet({ key: 'key1', factory: () => ({ foo: 'bar' }) })

    // wait til key is expired
    await sleep(50)

    // should returns graced value
    const r2 = await cache.getOrSet({ key: 'key1', factory: throwingFactory() })

    await sleep(300)

    // Graced value is now expired. Factory should be called
    const r3 = cache.getOrSet({ key: 'key1', factory: throwingFactory('Error in cb') })

    assert.deepEqual(r1, { foo: 'bar' })
    assert.deepEqual(r2, { foo: 'bar' })
    await assert.rejects(async () => r3, 'Factory has thrown an error')
  })

  test('if grace enabled with graceBackoff it should not try to call factory afterwards', async ({
    assert,
  }) => {
    const { cache } = new CacheFactory()
      .withMemoryL1()
      .merge({ ttl: 10, grace: '6h', graceBackoff: '0.5s', timeout: '2s' })
      .create()

    const r1 = await cache.getOrSet({ key: 'key1', factory: () => ({ foo: 'bar' }) })

    // wait til key is expired
    await sleep(50)

    // should returns graced value
    const r2 = await cache.getOrSet({ key: 'key1', factory: throwingFactory('Error in cb') })

    // this factory should not be called since graceBackoff is 5s
    let factory1Called = false
    const r3 = await cache.getOrSet({
      key: 'key1',
      factory: async () => {
        factory1Called = true
        throw new Error('should not be called')
      },
    })

    await sleep(800)

    // wait til graceBackoff is expired. Factory should be called
    const r4 = await cache.getOrSet({ key: 'key1', factory: async () => ({ foo: 'baz' }) })

    assert.deepEqual(r1, { foo: 'bar' })
    assert.deepEqual(r2, { foo: 'bar' })
    assert.deepEqual(r3, { foo: 'bar' })
    assert.deepEqual(r4, { foo: 'baz' })
    assert.isFalse(factory1Called)
  })

  test('soft timeout should returns old value if factory take too long', async ({ assert }) => {
    const { cache } = new CacheFactory()
      .withMemoryL1()
      .merge({ ttl: 100, timeout: 500, grace: '10m' })
      .create()

    // init the cache
    const r1 = await cache.getOrSet({ key: 'key1', factory: () => ({ foo: 'bar' }) })

    // wait for expiration
    await sleep(100)

    // factory that will exceed soft timeout
    const r2 = await cache.getOrSet({ key: 'key1', factory: slowFactory(550, { foo: 'baz' }) })

    // wait til factory is done
    await sleep(50)

    // get the value
    const r3 = await cache.getOrSet({ key: 'key1', factory: () => ({ foo: 'bazzz' }) })

    assert.deepEqual(r1, r2)
    assert.deepEqual(r3, { foo: 'baz' })
  }).disableTimeout()

  test('should be able to specify a lock timeout', async ({ assert }) => {
    const { cache } = new CacheFactory().withMemoryL1().merge({ lockTimeout: 100 }).create()

    const r1 = cache.getOrSet({ key: 'key1', ttl: '10ms', factory: slowFactory(500, 'value') })
    const r2 = cache.getOrSet({ key: 'key1', ttl: '10ms', factory: throwingFactory() })

    const [result1, result2] = await Promise.allSettled([r1, r2])

    // @ts-ignore
    assert.deepEqual(result1.value, 'value')
    assert.equal(result2.status, 'rejected')
  })

  test('should not serialize l1 if serializeL1 is false', async ({ assert }) => {
    const { cache } = new CacheFactory().withMemoryL1({ serialize: false }).withRedisL2().create()

    await cache.set({ key: 'foo', value: { date: new Date() } })
    const r1 = await cache.get({ key: 'foo' })
    const r2 = await cache.getOrSet({ key: 'bar', factory: () => ({ date: new Date() }) })
    const r3 = await cache.get({ key: 'bar' })

    assert.instanceOf(r1.date, Date)
    assert.instanceOf(r2.date, Date)
    assert.instanceOf(r3.date, Date)

    const { cache: cache2 } = new CacheFactory().withMemoryL1().withRedisL2().create()

    const r4 = await cache2.get({ key: 'foo' })
    assert.isString(r4.date)
  })

  test('has correct timestamp', async ({ assert }) => {
    const { local, cache, stack } = new CacheFactory().withMemoryL1().create()
    const testValue = { key: 'testKey', value: 'testValue' }

    await cache.set(testValue)
    const r1 = local.get(testValue.key, stack.defaultOptions)
    await sleep(100)
    const r2 = local.get(testValue.key, stack.defaultOptions)

    assert.isDefined(r1?.entry.getCreatedAt())
    assert.deepEqual(r1?.entry.getCreatedAt(), r2?.entry.getCreatedAt())
  })

  test('getOrSet() should execute factory when forceFresh is true', async ({ assert }) => {
    const { cache } = new CacheFactory().withMemoryL1().create()

    // First set a value
    await cache.set({ key: 'key1', value: 'initial', ttl: '1h' })

    // Then try to get it with forceFresh
    const value = await cache.getOrSet({
      key: 'key1',
      factory: () => 'updated',
      forceFresh: true,
    })

    assert.equal(value, 'updated')
    assert.equal(await cache.get({ key: 'key1' }), 'updated')
  })

  test('getOrSet() with forceFresh should execute factory even during grace period', async ({
    assert,
  }) => {
    const { cache } = new CacheFactory().withMemoryL1().merge({ grace: '1h' }).create()

    // Set initial value with short TTL
    await cache.getOrSet({
      key: 'key1',
      ttl: '10ms',
      factory: () => 'initial',
    })

    // Wait for TTL to expire, now we're in grace period
    await sleep(20)

    // Get with forceFresh should ignore grace period and execute factory
    const value = await cache.getOrSet({
      key: 'key1',
      factory: () => 'updated',
      forceFresh: true,
    })

    assert.equal(value, 'updated')
    assert.equal(await cache.get({ key: 'key1' }), 'updated')
  })

  test('getOrSet() with forceFresh should throw if factory throws', async ({ assert }) => {
    const { cache } = new CacheFactory().withMemoryL1().merge({ grace: '1h' }).create()

    // Set initial value
    await cache.set({ key: 'key1', value: 'initial' })

    // Get with forceFresh and throwing factory
    await assert.rejects(() =>
      cache.getOrSet({
        key: 'key1',
        factory: throwingFactory('forced error'),
        forceFresh: true,
      }),
    )

    // Original value should still be intact
    assert.equal(await cache.get({ key: 'key1' }), 'initial')
  })
})
