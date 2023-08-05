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

import { CacheFactory } from '../../factories/cache_factory.js'
import { throwingFactory, waitAndReturnFactory } from '../../test_helpers/index.js'

test.group('Cache | getOrSet', (group) => {
  test('getOrSet() returns value when key exists', async ({ assert, cleanup }) => {
    const { cache, teardown } = new CacheFactory().create()
    cleanup(teardown)

    await cache.set('key1', { foo: 'bar' })
    const value = await cache.getOrSet('key1', () => ({ foo: 'baz' }))

    assert.deepEqual(value, { foo: 'bar' })
  })

  test('getOrSet() store values when key does not exists', async ({ assert, cleanup }) => {
    const { cache, teardown } = new CacheFactory().create()
    cleanup(teardown)

    const value = await cache.getOrSet('key1', () => ({ foo: 'bar' }))
    assert.deepEqual(value, { foo: 'bar' })
    assert.deepEqual(await cache.get('key1'), { foo: 'bar' })
  })

  test('getOrSet() with specific ttl', async ({ assert, cleanup }) => {
    const { cache, teardown } = new CacheFactory().create()
    cleanup(teardown)

    await cache.getOrSet('key1', '10ms', () => ({ foo: 'bar' }))
    await setTimeout(20)

    assert.isUndefined(await cache.get('key1'))
  })

  test('graceful retain should returns old value if cb throws', async ({ assert, cleanup }) => {
    assert.plan(3)

    const { cache, teardown } = new CacheFactory().create()
    cleanup(teardown)

    const result = await cache.getOrSet('key1', '10ms', () => ({ foo: 'bar' }), {
      gracefulRetain: { enabled: true, duration: '10m' },
    })

    await setTimeout(100)
    const result2 = await cache.getOrSet(
      'key1',
      '10ms',
      () => {
        // Since key1 is logically expired, this factory should be called
        assert.incrementAssertionsCount()
        throw new Error('foo')
      },
      { gracefulRetain: { enabled: true, duration: '10m' } }
    )

    assert.deepEqual(result, { foo: 'bar' })
    assert.deepEqual(result2, { foo: 'bar' })
  })

  test('graceful retain should not returns old value if cb doesnt throws', async ({
    assert,
    cleanup,
  }) => {
    const { cache, teardown } = new CacheFactory().create()
    cleanup(teardown)

    const result = await cache.getOrSet('key1', '10ms', () => ({ foo: 'bar' }), {
      gracefulRetain: { enabled: true, duration: '10m' },
    })

    await setTimeout(100)

    const result2 = await cache.getOrSet('key1', '10ms', () => ({ foo: 'baz' }), {
      gracefulRetain: { enabled: true, duration: '10m' },
    })

    assert.deepEqual(result, { foo: 'bar' })
    assert.deepEqual(result2, { foo: 'baz' })
  })

  test('should throws if gracefully retained value is outdated', async ({ assert, cleanup }) => {
    const { cache, teardown } = new CacheFactory().create()
    cleanup(teardown)

    const result = await cache.getOrSet('key1', '10ms', () => ({ foo: 'bar' }), {
      gracefulRetain: { enabled: true, duration: '100ms' },
    })

    assert.deepEqual(result, { foo: 'bar' })
    await setTimeout(50)

    const result2 = await cache.getOrSet('key1', '10ms', () => throwingFactory(), {
      gracefulRetain: { enabled: true, duration: '100ms' },
    })

    assert.deepEqual(result2, { foo: 'bar' })
    await setTimeout(100)

    await assert.rejects(async () => {
      return cache.getOrSet('key1', '10ms', () => throwingFactory('Error in cb'), {
        gracefulRetain: { enabled: true, duration: '100ms' },
      })
    }, /Error in cb/)
  })

  test('should use the default duration when not defined', async ({ assert, cleanup }) => {
    const { cache, teardown } = new CacheFactory()
      .merge({ gracefulRetain: { enabled: true, duration: '100ms' } })
      .create()

    cleanup(teardown)

    await cache.getOrSet('key1', '10ms', () => ({ foo: 'bar' }))
    await setTimeout(50)

    const res = await cache.getOrSet('key1', '10ms', () => throwingFactory())
    assert.deepEqual(res, { foo: 'bar' })

    await setTimeout(50)
    await assert.rejects(
      async () => cache.getOrSet('key1', '10ms', () => throwingFactory('fail')),
      /fail/
    )
  })

  test('early expiration', async ({ assert, cleanup }) => {
    const { cache, teardown } = new CacheFactory()
      .merge({ earlyExpiration: 0.5, ttl: 100 })
      .create()

    cleanup(teardown)

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

  test('early refresh should be locked. only one factory call', async ({ assert, cleanup }) => {
    const { cache, teardown } = new CacheFactory()
      .merge({ earlyExpiration: 0.5, ttl: 100 })
      .create()

    cleanup(teardown)

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

  test('earlyexpiration of >= 0 or <= 1 should be ignored', async ({ assert, cleanup }) => {
    const { cache, teardown, driver } = new CacheFactory().merge({ ttl: 100 }).create()

    cleanup(teardown)

    await cache.getOrSet('key1', () => ({ foo: 'bar' }), { earlyExpiration: 1 })
    await cache.getOrSet('key2', () => ({ foo: 'bar' }), { earlyExpiration: 0 })

    assert.notInclude(driver.get('key1'), 'earlyExpiration')
    assert.notInclude(driver.get('key2'), 'earlyExpiration')
  })

  test('early refresh should re-increment physical/logical ttls', async ({ assert, cleanup }) => {
    const { cache, teardown } = new CacheFactory()
      .merge({ earlyExpiration: 0.5, ttl: 100 })
      .create()

    cleanup(teardown)

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
