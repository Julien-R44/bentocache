import { test } from '@japa/runner'
import { setTimeout } from 'node:timers/promises'

import { throwingFactory, waitAndReturnFactory } from '../../test_helpers/index.js'
import { CacheFactory } from '../../factories/cache_factory.js'

test.group('One tier tests', () => {
  test('get() returns deserialized value', async ({ assert }) => {
    const { cache } = new CacheFactory().create()

    await cache.set('key', { foo: 'bar' })
    assert.deepEqual(await cache.get('key'), { foo: 'bar' })

    await cache.set('key', ['foo', 'bar'])
    assert.deepEqual(await cache.get('key'), ['foo', 'bar'])

    await cache.set('key', 1)
    assert.deepEqual(await cache.get('key'), 1)

    await cache.set('key', true)
    assert.deepEqual(await cache.get('key'), true)
  })

  test('get() with default value fallback', async ({ assert }) => {
    const { cache } = new CacheFactory().create()

    const r1 = await cache.get('key', 'default')
    const r2 = await cache.get('key', () => 'default')

    assert.equal(r1, 'default')
    assert.equal(r2, 'default')
  })

  test('get() with fallback but item found should return item', async ({ assert }) => {
    const { cache } = new CacheFactory().create()

    await cache.set('key', 'value')
    const r1 = await cache.get('key', 'default')

    assert.equal(r1, 'value')
  })

  test('get() with graceful retain', async ({ assert }) => {
    const { cache } = new CacheFactory()
      .merge({ gracefulRetain: { enabled: true, duration: '4h' } })
      .create()

    await cache.set('key', 'value', { ttl: '100ms' })
    await setTimeout(100)

    const r1 = await cache.get('key')
    const r2 = await cache.get('key', undefined, {
      gracefulRetain: { enabled: false },
    })

    assert.deepEqual(r1, 'value')
    assert.isUndefined(r2)
  })

  test('get() should not use graceful retain when disabled', async ({ assert }) => {
    const { cache } = new CacheFactory()
      .merge({ gracefulRetain: { enabled: false, duration: '500ms' } })
      .create()

    // init key with grace period
    await cache.getOrSet('key', '10ms', () => 'value', {
      gracefulRetain: { enabled: true, duration: '500ms' },
    })

    // we should get value
    const r1 = await cache.get('key')

    // wait til key expires
    await setTimeout(100)

    // we should not get value since grace period is disabled globally
    const r2 = await cache.get('key')

    // Otherwise if we had enabled grace period, we would get value
    const result = await cache.getOrSet('key', '10ms', throwingFactory('DB call failed'), {
      gracefulRetain: { enabled: true, duration: '500ms' },
    })

    assert.deepEqual(r1, 'value')
    assert.deepEqual(r2, undefined)
    assert.deepEqual(result, 'value')
  })

  test('missing() returns true when key does not exists', async ({ assert }) => {
    const { cache } = new CacheFactory().create()
    assert.isTrue(await cache.missing('key1'))
  })

  test('missing() returns false when key exists', async ({ assert }) => {
    const { cache } = new CacheFactory().create()

    await cache.set('key1', 'value1')
    assert.isFalse(await cache.missing('key1'))
  })

  test('missing() returns false even if logically expired', async ({ assert }) => {
    const { cache } = new CacheFactory()
      .merge({ gracefulRetain: { enabled: true, duration: '500ms' } })
      .create()

    await cache.set('key1', 'value1', { ttl: '100ms' })

    await setTimeout(100)
    const r1 = await cache.missing('key1')

    await setTimeout(500)
    const r2 = await cache.missing('key1')

    assert.isFalse(r1)
    assert.isTrue(r2)
  })

  test('has() returns false when key does not exists', async ({ assert }) => {
    const { cache } = new CacheFactory().create()
    assert.isFalse(await cache.has('key1'))
  })

  test('has() returns true when key exists', async ({ assert }) => {
    const { cache } = new CacheFactory().create()

    await cache.set('key1', 'value1')
    assert.isTrue(await cache.has('key1'))
  })

  test('has() returns true even if logically expired', async ({ assert }) => {
    const { cache } = new CacheFactory()
      .merge({ gracefulRetain: { enabled: true, duration: '500ms' } })
      .create()

    await cache.set('key1', 'value1', { ttl: '100ms' })
    await setTimeout(100)

    const r1 = await cache.has('key1')

    await setTimeout(500)
    const r2 = await cache.has('key1')

    assert.isTrue(r1)
    assert.isFalse(r2)
  })

  test('clear() remove all keys', async ({ assert }) => {
    const { cache } = new CacheFactory().create()

    await cache.set('key1', 'value1', { ttl: '100ms' })
    await cache.set('key2', 'bar')
    await cache.namespace('users').set('key3', 'blabla')

    await cache.clear()

    assert.isFalse(await cache.has('key1'))
    assert.isFalse(await cache.has('key2'))
    assert.isFalse(await cache.namespace('users').has('key3'))
  })

  test('delete should delete key', async ({ assert }) => {
    const { cache } = new CacheFactory()
      .merge({ gracefulRetain: { enabled: true, duration: '500ms' } })
      .create()

    await cache.set('key1', 'value1', { ttl: '100ms' })
    await cache.set('key2', 'bar')

    await setTimeout(100)

    await cache.delete('key1')
    await cache.delete('key2')

    assert.isFalse(await cache.has('key1'))
    assert.isFalse(await cache.has('key2'))
  })

  // TODO test pull ?

  test('getOrSetForever() should set value forever', async ({ assert }) => {
    const { cache } = new CacheFactory().merge({ ttl: 100 }).create()

    await cache.getOrSetForever('key', () => 'value')
    assert.deepEqual(await cache.get('key'), 'value')

    await setTimeout(100)

    assert.deepEqual(await cache.get('key'), 'value')
  })

  test('getOrSetForever() returns value when key exists', async ({ assert }) => {
    const { cache } = new CacheFactory().create()

    await cache.set('key1', { foo: 'bar' })
    const r1 = await cache.getOrSetForever('key1', throwingFactory('shouldnt be called'))

    assert.deepEqual(r1, { foo: 'bar' })
  })

  test('getOrSetForever() store values when key does not exists', async ({ assert }) => {
    const { cache } = new CacheFactory().create()

    const value = await cache.getOrSetForever('key1', () => ({ foo: 'bar' }))
    assert.deepEqual(value, { foo: 'bar' })
    assert.deepEqual(await cache.get('key1'), { foo: 'bar' })
  })

  test('setForever() store a value forever', async ({ assert }) => {
    const { cache } = new CacheFactory().merge({ ttl: 10 }).create()

    await cache.setForever('key', 'value')
    await setTimeout(30)
    assert.deepEqual(await cache.get('key'), 'value')
  })

  test('setForever() returns true when value is set', async ({ assert }) => {
    const { cache } = new CacheFactory().create()

    const result = await cache.setForever('key', 'value')
    assert.isTrue(result)
  })

  test('getOrSet() returns value when key exists', async ({ assert }) => {
    const { cache } = new CacheFactory().create()

    await cache.set('key1', { foo: 'bar' })
    const value = await cache.getOrSet('key1', () => ({ foo: 'baz' }))

    assert.deepEqual(value, { foo: 'bar' })
  })

  test('getOrSet() returns value when key exists', async ({ assert }) => {
    const { cache } = new CacheFactory().create()

    await cache.set('key1', { foo: 'bar' })
    const value = await cache.getOrSet('key1', () => ({ foo: 'baz' }))

    assert.deepEqual(value, { foo: 'bar' })
  })

  test('getOrSet() store values when key does not exists', async ({ assert }) => {
    const { cache } = new CacheFactory().create()

    const value = await cache.getOrSet('key1', () => ({ foo: 'bar' }))

    assert.deepEqual(value, { foo: 'bar' })
    assert.deepEqual(await cache.get('key1'), { foo: 'bar' })
  })

  test('getOrSet() with specific ttl', async ({ assert }) => {
    const { cache } = new CacheFactory().create()

    await cache.getOrSet('key1', '10ms', () => ({ foo: 'bar' }))
    await setTimeout(20)

    assert.isUndefined(await cache.get('key1'))
  })

  test('graceful retain should returns old value if factory throws', async ({ assert }) => {
    assert.plan(3)

    const { cache } = new CacheFactory()
      .merge({ ttl: 10, gracefulRetain: { enabled: true, duration: '10m' } })
      .create()

    const result = await cache.getOrSet('key1', () => ({ foo: 'bar' }))

    await setTimeout(100)
    const result2 = await cache.getOrSet('key1', () => {
      // Since key1 is logically expired, this factory should be called
      assert.incrementAssertionsCount()
      throw new Error('foo')
    })

    assert.deepEqual(result, { foo: 'bar' })
    assert.deepEqual(result2, { foo: 'bar' })
  })

  test('graceful retain should not returns old value if factory doesnt throws', async ({
    assert,
  }) => {
    const { cache } = new CacheFactory()
      .merge({ ttl: 10, gracefulRetain: { enabled: true, duration: '10m' } })
      .create()

    const r1 = await cache.getOrSet('key1', () => ({ foo: 'bar' }))

    await setTimeout(100)

    const r2 = await cache.getOrSet('key1', () => ({ foo: 'baz' }))

    assert.deepEqual(r1, { foo: 'bar' })
    assert.deepEqual(r2, { foo: 'baz' })
  })

  test('should throws if gracefully retained value is now expired', async ({ assert }) => {
    const { cache } = new CacheFactory()
      .merge({ ttl: 10, gracefulRetain: { enabled: true, duration: '100ms' } })
      .create()

    // init cache
    const r1 = await cache.getOrSet('key1', () => ({ foo: 'bar' }))

    // wait til key is expired
    await setTimeout(50)

    // should returns gracefully retained value
    const r2 = await cache.getOrSet('key1', throwingFactory())

    await setTimeout(100)

    // Gracefully retained value is now expired. Factory should be called
    const r3 = cache.getOrSet('key1', throwingFactory('Error in cb'))

    assert.deepEqual(r1, { foo: 'bar' })
    assert.deepEqual(r2, { foo: 'bar' })
    await assert.rejects(async () => r3, 'Error in cb')
  })

  test('early expiration', async ({ assert }) => {
    const { cache } = new CacheFactory().merge({ earlyExpiration: 0.5, ttl: 100 }).create()

    assert.plan(5)

    // Call factory
    const r1 = await cache.getOrSet('key1', () => ({ foo: 'bar' }))

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
    const { cache } = new CacheFactory().merge({ earlyExpiration: 0.5, ttl: 100 }).create()

    assert.plan(4)

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

  test('early expiration of >= 0 or <= 1 should be ignored', async ({ assert }) => {
    const { cache, local } = new CacheFactory().merge({ ttl: 100 }).create()

    await cache.getOrSet('key1', () => ({ foo: 'bar' }), { earlyExpiration: 1 })
    await cache.getOrSet('key2', () => ({ foo: 'bar' }), { earlyExpiration: 0 })

    assert.notInclude(local.get('key1'), 'earlyExpiration')
    assert.notInclude(local.get('key2'), 'earlyExpiration')
  })

  test('early refresh should re-increment physical/logical ttls', async ({ assert }) => {
    const { cache } = new CacheFactory().merge({ earlyExpiration: 0.5, ttl: 100 }).create()

    // init cache
    const r1 = await cache.getOrSet('key1', () => ({ foo: 'bar' }))

    // wait for early refresh threshold
    await setTimeout(60)

    // call factory. should returns the old value.
    // Disable early expiration to test physical ttl
    const r2 = await cache.getOrSet('key1', waitAndReturnFactory(50, { foo: 'baz' }), {
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
})
