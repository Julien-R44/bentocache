/*
 * @adonisjs/cache
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { test } from '@japa/runner'
import { setTimeout } from 'node:timers/promises'

import { CacheItem } from '../../../src/cache_item.js'
import { Memory } from '../../../src/drivers/memory.js'
import { CacheFactory } from '../../../factories/cache_factory.js'
import { ChaosCache } from '../../../test_helpers/chaos_cache.js'
import { throwingFactory, waitAndReturnFactory } from '../../../test_helpers/index.js'

test.group('Cache | getOrSet', () => {
  test('returns value when key exists in local', async ({ assert }) => {
    const { cache, local } = new CacheFactory().withHybridConfig().create()

    await local.set('key1', JSON.stringify({ value: 'bar' }))
    const value = await cache.getOrSet('key1', throwingFactory('should not be called'))

    assert.deepEqual(value, 'bar')
  })

  test('returns value when key exists in remote', async ({ assert }) => {
    const { cache, remote } = new CacheFactory().withHybridConfig().create()

    await remote.set('key1', JSON.stringify({ value: 'bar' }))
    const value = await cache.getOrSet('key1', throwingFactory('should not be called'))

    assert.deepEqual(value, 'bar')
  })

  test('set value in local when key does not exist in local but exists in remote', async ({
    assert,
  }) => {
    const { cache, local, remote } = new CacheFactory().withHybridConfig().create()

    await remote.set('key1', JSON.stringify({ value: 'bar' }))
    const value = await cache.getOrSet('key1', throwingFactory('should not be called'))
    const localeValue = await local.get('key1')

    assert.deepEqual(value, 'bar')
    assert.deepEqual(localeValue, JSON.stringify({ value: 'bar' }))
  })

  test('store values in both when key does not exists in local and remote', async ({ assert }) => {
    const { cache, local, remote } = new CacheFactory().withHybridConfig().create()

    const value = await cache.getOrSet('key1', waitAndReturnFactory(40, 'bar'))

    const localeValue = CacheItem.fromDriver('key1', await local.get('key1'))
    const remoteValue = CacheItem.fromDriver('key1', (await remote.get('key1')) as any)

    assert.deepEqual(value, 'bar')
    assert.deepEqual(localeValue.getValue(), 'bar')
    assert.deepEqual(remoteValue.getValue(), 'bar')
  })

  test('with specific ttl', async ({ assert }) => {
    const { cache, local, remote } = new CacheFactory().withHybridConfig().create()

    await cache.getOrSet('key1', '10ms', () => ({ foo: 'bar' }))
    await setTimeout(20)

    assert.isUndefined(await cache.get('key1'))
    assert.isUndefined(await local.get('key1'))
    assert.isUndefined(await remote.get('key1'))
  })

  test('retain should returns old value if cb throws', async ({ assert }) => {
    assert.plan(3)

    const { cache } = new CacheFactory()
      .withHybridConfig()
      .merge({ gracefulRetain: { enabled: true, duration: '10m' } })
      .create()

    // init first value
    const r1 = await cache.getOrSet('key1', '10ms', () => ({ foo: 'bar' }))

    await setTimeout(100)
    const r2 = await cache.getOrSet('key1', '10ms', () => {
      // Since key1 is logically expired, this factory should be called
      assert.incrementAssertionsCount()
      throw new Error('foo')
    })

    assert.deepEqual(r1, { foo: 'bar' })
    assert.deepEqual(r2, { foo: 'bar' })
  })

  test('graceful retain should not returns old value if cb doesnt throws', async ({ assert }) => {
    const { cache } = new CacheFactory()
      .withHybridConfig()
      .merge({ gracefulRetain: { enabled: true, duration: '10m' } })
      .create()

    const r1 = await cache.getOrSet('key1', '10ms', () => ({ foo: 'bar' }))
    await setTimeout(100)

    const r2 = await cache.getOrSet('key1', '10ms', () => ({ foo: 'baz' }))

    assert.deepEqual(r1, { foo: 'bar' })
    assert.deepEqual(r2, { foo: 'baz' })
  })

  test('should throws if gracefully retained value is outdated', async ({ assert }) => {
    const { cache } = new CacheFactory()
      .merge({ gracefulRetain: { enabled: true, duration: '100ms' } })
      .create()

    // init factory
    const r1 = await cache.getOrSet('key1', '10ms', () => ({ foo: 'bar' }))

    // re-get with throwing factory. still in grace period
    const r2 = await cache.getOrSet('key1', '10ms', throwingFactory('should not be called'))
    await setTimeout(101)

    // re-get with throwing factory. out of grace period. should throws
    const r3 = cache.getOrSet('key1', '10ms', throwingFactory('error in factory'))

    assert.deepEqual(r1, { foo: 'bar' })
    assert.deepEqual(r2, { foo: 'bar' })
    await assert.rejects(() => r3, /error in factory/)
  })

  test('should use the default duration when not defined', async ({ assert }) => {
    const { cache } = new CacheFactory()
      .withHybridConfig()
      .merge({ gracefulRetain: { enabled: true, duration: '100ms' } })
      .create()

    await cache.getOrSet('key1', '10ms', () => ({ foo: 'bar' }))
    await setTimeout(50)

    const r1 = await cache.getOrSet('key1', '10ms', throwingFactory())

    await setTimeout(50)
    const r2 = cache.getOrSet('key1', '10ms', throwingFactory('fail'))

    assert.deepEqual(r1, { foo: 'bar' })
    await assert.rejects(() => r2, /fail/)
  })

  test('early expiration', async ({ assert }) => {
    assert.plan(5)

    const { cache } = new CacheFactory()
      .withHybridConfig()
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
      .withHybridConfig()
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
    const { cache, driver } = new CacheFactory().withHybridConfig().merge({ ttl: 100 }).create()

    await cache.getOrSet('key1', () => ({ foo: 'bar' }), { earlyExpiration: 1 })
    await cache.getOrSet('key2', () => ({ foo: 'bar' }), { earlyExpiration: 0 })

    assert.notInclude(driver.get('key1'), 'earlyExpiration')
    assert.notInclude(driver.get('key2'), 'earlyExpiration')
  })

  test('early refresh should re-increment physical/logical ttls', async ({ assert }) => {
    const { cache } = new CacheFactory()
      .merge({ earlyExpiration: 0.5, ttl: 100 })
      .withHybridConfig()
      .create()

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

  test('handles failure in remote cache when retain is enabled', async ({ assert }) => {
    const remoteDriver = new ChaosCache(new Memory({ maxSize: 10, prefix: 'test' }))

    const { cache } = new CacheFactory()
      .withHybridConfig(remoteDriver)
      .merge({ gracefulRetain: { enabled: true, duration: '2h' } })
      .create()

    // init cache
    const r1 = await cache.getOrSet('key1', '100ms', () => ({ foo: 'bar' }))

    // make the remote cache fail
    remoteDriver.alwaysThrow()

    // wait till we enter the grace period
    await setTimeout(100)

    // get the value again
    const r2 = await cache.getOrSet('key1', () => ({ foo: 'baz' }))

    // should have served the old value
    assert.deepEqual(r1, r2)
  })

  test('rethrows error when suppressRemoteCacheErrors is false', async ({ assert }) => {
    const remoteDriver = new ChaosCache(new Memory({ maxSize: 10, prefix: 'test' }))

    const { cache } = new CacheFactory()
      .withHybridConfig(remoteDriver)
      .merge({ gracefulRetain: { enabled: true, duration: '2h' } })
      .create()

    // init cache
    await cache.getOrSet('key1', '100ms', () => ({ foo: 'bar' }))

    // make the remote cache fail
    remoteDriver.alwaysThrow()

    // wait till we enter the grace period
    await setTimeout(100)

    // get the value again
    const r2 = cache.getOrSet('key1', () => ({ foo: 'baz' }), {
      suppressRemoteCacheErrors: false,
    })

    await assert.rejects(() => r2, 'Chaos: Random error')
  })
})
