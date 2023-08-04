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

import type { Cache } from '../../src/cache.js'
import { CacheFactory } from '../../factories/cache_factory.js'
import { throwingCb } from '../../test_helpers/index.js'

test.group('Cache | getOrSet', (group) => {
  let cache: Cache

  group.each.setup(() => {
    cache = new CacheFactory().create()

    return async () => {
      await cache.clear()
      await cache.disconnect()
    }
  })

  test('getOrSet() returns value when key exists', async ({ assert }) => {
    await cache.set('key1', { foo: 'bar' })
    const value = await cache.getOrSet('key1', () => ({ foo: 'baz' }))

    assert.deepEqual(value, { foo: 'bar' })
  })

  test('getOrSet() store values when key does not exists', async ({ assert }) => {
    const value = await cache.getOrSet('key1', () => ({ foo: 'bar' }))
    assert.deepEqual(value, { foo: 'bar' })
    assert.deepEqual(await cache.get('key1'), { foo: 'bar' })
  })

  test('getOrSet() with specific ttl', async ({ assert }) => {
    await cache.getOrSet('key1', '10ms', () => ({ foo: 'bar' }))
    await setTimeout(20)

    assert.isUndefined(await cache.get('key1'))
  })

  test('graceful retain should returns old value if cb throws', async ({ assert }) => {
    assert.plan(3)

    const result = await cache.getOrSet('key1', '10ms', () => ({ foo: 'bar' }), {
      gracefulRetain: { enabled: true, duration: '10m' },
    })

    await setTimeout(100)
    const result2 = await cache.getOrSet(
      'key1',
      '10ms',
      () => {
        // Since key1 is logically expired, this callback should be called
        assert.incrementAssertionsCount()
        throw new Error('foo')
      },
      { gracefulRetain: { enabled: true, duration: '10m' } }
    )

    assert.deepEqual(result, { foo: 'bar' })
    assert.deepEqual(result2, { foo: 'bar' })
  })

  test('graceful retain should not returns old value if cb doesnt throws', async ({ assert }) => {
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

  test('should throws if gracefully retained value is outdated', async ({ assert }) => {
    const result = await cache.getOrSet('key1', '10ms', () => ({ foo: 'bar' }), {
      gracefulRetain: { enabled: true, duration: '100ms' },
    })

    assert.deepEqual(result, { foo: 'bar' })
    await setTimeout(50)

    const result2 = await cache.getOrSet('key1', '10ms', () => throwingCb(), {
      gracefulRetain: { enabled: true, duration: '100ms' },
    })

    assert.deepEqual(result2, { foo: 'bar' })
    await setTimeout(100)

    await assert.rejects(async () => {
      return cache.getOrSet('key1', '10ms', () => throwingCb('Error in cb'), {
        gracefulRetain: { enabled: true, duration: '100ms' },
      })
    }, /Error in cb/)
  })

  test('should use the default duration when not defined', async ({ assert, cleanup }) => {
    const { cache: cache2, teardown } = new CacheFactory()
      .merge({ gracefulRetain: { enabled: true, duration: '100ms' } })
      .createWithTeardown()

    cleanup(teardown)

    await cache2.getOrSet('key1', '10ms', () => ({ foo: 'bar' }))
    await setTimeout(50)

    const res = await cache2.getOrSet('key1', '10ms', () => throwingCb())
    assert.deepEqual(res, { foo: 'bar' })

    await setTimeout(50)
    await assert.rejects(
      async () => cache2.getOrSet('key1', '10ms', () => throwingCb('fail')),
      /fail/
    )
  })
})
