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

import type { Cache } from '../../src/providers/cache.js'
import { CacheFactory } from '../../factories/cache_factory.js'
import { cleanupCache, throwingCb } from '../../test_helpers/index.js'

test.group('Cache', (group) => {
  let cache: Cache

  group.each.setup(() => {
    cache = new CacheFactory().create()

    return async () => {
      await cache.clear()
      await cache.disconnect()
    }
  })

  test('get() returns deserialized value', async ({ assert }) => {
    await cache.set('key', { foo: 'bar' })
    assert.deepEqual(await cache.get('key'), { foo: 'bar' })

    await cache.set('key', ['foo', 'bar'])
    assert.deepEqual(await cache.get('key'), ['foo', 'bar'])

    await cache.set('key', 1)
    assert.deepEqual(await cache.get('key'), 1)

    await cache.set('key', true)
    assert.deepEqual(await cache.get('key'), true)
  })

  test('get() with default value', async ({ assert }) => {
    assert.deepEqual(await cache.get('key', 'default'), 'default')
  })

  test('get() also use graceful retain', async ({ assert, cleanup }) => {
    const { cache: cache2, teardown } = new CacheFactory()
      .merge({ gracefulRetain: { enabled: true, duration: '500ms' } })
      .createWithTeardown()

    cleanup(teardown)

    await cache2.getOrSet('key', '10ms', () => 'value')
    assert.deepEqual(await cache2.get('key'), 'value')
    await setTimeout(100)
    assert.deepEqual(await cache2.get('key'), 'value')
  })

  test('get() dont use graceful retain when disabled globally', async ({ assert, cleanup }) => {
    const { cache: cache2, teardown } = new CacheFactory()
      .merge({ gracefulRetain: { enabled: false, duration: '500ms' } })
      .createWithTeardown()

    cleanup(teardown)

    await cache2.getOrSet('key', '10ms', () => 'value', {
      gracefulRetain: { enabled: true, duration: '500ms' },
    })

    assert.deepEqual(await cache2.get('key'), 'value')
    await setTimeout(100)
    assert.isUndefined(await cache2.get('key'))

    const result = await cache2.getOrSet('key', '10ms', () => throwingCb('DB call failed'), {
      gracefulRetain: { enabled: true, duration: '500ms' },
    })

    assert.deepEqual(result, 'value')
  })

  test('getMany() with default value', async ({ assert }) => {
    await cache.setMany([{ key: 'key1', value: 'value1' }])

    const result = await cache.getMany(
      ['key1', 'key2', 'key3'],
      ['default1', 'default2', 'default3']
    )

    assert.deepEqual(result, [
      { key: 'key1', value: 'value1' },
      { key: 'key2', value: 'default2' },
      { key: 'key3', value: 'default3' },
    ])
  })

  test('missing() returns true when key does not exists', async ({ assert }) => {
    assert.isTrue(await cache.missing('key1'))
  })

  test('missing() returns false when key exists', async ({ assert }) => {
    await cache.set('key1', 'value1')
    assert.isFalse(await cache.missing('key1'))
  })

  test('getOrSetForever() returns value when key exists', async ({ assert }) => {
    await cache.set('key1', { foo: 'bar' })
    const value = await cache.getOrSetForever('key1', () => ({ foo: 'baz' }))

    assert.deepEqual(value, { foo: 'bar' })
    assert.deepEqual(await cache.get('key1'), { foo: 'bar' })
  })

  test('getOrSetForever() store values when key does not exists', async ({ assert }) => {
    const value = await cache.getOrSetForever('key1', () => ({ foo: 'bar' }))
    assert.deepEqual(value, { foo: 'bar' })
    assert.deepEqual(await cache.get('key1'), { foo: 'bar' })
  })

  test('getOrSetForever() store items forever', async ({ assert, cleanup }) => {
    const cache2 = new CacheFactory().merge({ ttl: 10 }).create()
    cleanup(cleanupCache(cache2))

    await cache2.getOrSetForever('key1', () => ({ foo: 'bar' }))
    await setTimeout(20)
    assert.deepEqual(await cache2.get('key1'), { foo: 'bar' })
  })

  test('setForever() store a value forever', async ({ assert, cleanup }) => {
    const cache2 = new CacheFactory().merge({ ttl: 10 }).create()
    cleanup(cleanupCache(cache2))

    await cache2.setForever('key', 'value')
    await setTimeout(30)
    assert.deepEqual(await cache2.get('key'), 'value')
  })

  test('setForever() returns true when value is set', async ({ assert }) => {
    const result = await cache.setForever('key', 'value')
    assert.isTrue(result)
  })
})

test.group('Cache | Stampede protection', (group) => {
  let cache: Cache

  group.each.setup(() => {
    cache = new CacheFactory().create()

    return async () => {
      await cache.clear()
      await cache.disconnect()
    }
  })

  test('getOrSet should have cache stampede protection', async ({ assert }) => {
    assert.plan(2)

    const callback = async () => {
      await setTimeout(100)
      assert.incrementAssertionsCount()
      return 'value'
    }

    const results = await Promise.all([
      cache.getOrSet('key', callback),
      cache.getOrSet('key', callback),
    ])

    assert.deepEqual(results, ['value', 'value'])
  })

  test('getOrSetForever should have cache stampede protection', async ({ assert }) => {
    assert.plan(2)

    const callback = async () => {
      await setTimeout(100)
      assert.incrementAssertionsCount()
      return 'value'
    }

    const results = await Promise.all([
      cache.getOrSetForever('key', callback),
      cache.getOrSetForever('key', callback),
    ])

    assert.deepEqual(results, ['value', 'value'])
  })

  test('if callback throws an error it should release the lock', async ({ assert }) => {
    const results = await Promise.allSettled([
      cache.getOrSet('key', () => throwingCb('foo')),
      cache.getOrSet('key', async () => {
        await setTimeout(100)
        return 'value'
      }),
    ])

    assert.deepEqual(results, [
      { status: 'rejected', reason: new Error('foo') },
      { status: 'fulfilled', value: 'value' },
    ])
  })
})
