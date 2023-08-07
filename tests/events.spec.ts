/*
 * @adonisjs/cache
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { test } from '@japa/runner'
import EventEmitter from 'node:events'
import { pEvent, pEventMultiple } from 'p-event'

import { CacheFactory } from '../factories/cache_factory.js'

test.group('Cache events', () => {
  test('construct driver', async () => {
    const { cache } = new CacheFactory().create()
    await cache.disconnect()
  })

  test('emit cache:miss event when get() inexistent key', async ({ assert }) => {
    const emitter = new EventEmitter()
    const { cache } = new CacheFactory().merge({ emitter }).create()

    cache.get('key')

    const event = await pEvent(emitter, 'cache:miss')

    assert.deepEqual(event, {
      key: 'key',
      store: 'primary',
    })
  })

  test('emit cache:hit event when get() existing key', async ({ assert }) => {
    const emitter = new EventEmitter()
    const { cache } = new CacheFactory().merge({ emitter }).create()

    await cache.set('key', 'value')
    cache.get('key')

    const event = await pEvent(emitter, 'cache:hit')
    assert.deepEqual(event, {
      key: 'key',
      value: 'value',
      store: 'primary',
    })
  })

  test('emit cache:written event when calling set()', async ({ assert }) => {
    const emitter = new EventEmitter()
    const { cache } = new CacheFactory().merge({ emitter }).create()

    cache.set('key', 'value')

    const event = await pEvent(emitter, 'cache:written')
    assert.deepEqual(event, {
      key: 'key',
      value: 'value',
      store: 'primary',
    })
  })

  test('emit cache:deleted event when calling delete()', async ({ assert }) => {
    const emitter = new EventEmitter()
    const { cache } = new CacheFactory().merge({ emitter }).create()

    await cache.set('key', 'value')
    cache.delete('key')

    const event = await pEvent(emitter, 'cache:deleted')
    assert.deepEqual(event, {
      key: 'key',
      store: 'primary',
    })
  })

  test('pull() should emit cache:deleted and cache:hit events', async ({ assert }) => {
    const emitter = new EventEmitter()
    const { cache } = new CacheFactory().merge({ emitter }).create()

    await cache.set('key', 'value')
    cache.pull('key')

    const [deletedEvent, hitEvent] = await Promise.all([
      pEvent(emitter, 'cache:deleted'),
      pEvent(emitter, 'cache:hit'),
    ])

    assert.deepEqual(deletedEvent, {
      key: 'key',
      store: 'primary',
    })

    assert.deepEqual(hitEvent, {
      key: 'key',
      value: 'value',
      store: 'primary',
    })
  })

  test('pull() should not emit cache:deleted and cache:hit events if nothing was found', async ({
    assert,
  }) => {
    const emitter = new EventEmitter()
    const { cache } = new CacheFactory().merge({ emitter }).create()

    cache.pull('key').catch(() => {})

    const [deletedEvent, hitEvent] = await Promise.all([
      pEvent(emitter, 'cache:deleted', { timeout: 300 }).catch(() => undefined),
      pEvent(emitter, 'cache:hit', { timeout: 300 }).catch(() => undefined),
    ])

    assert.isUndefined(deletedEvent)
    assert.isUndefined(hitEvent)
  })

  test('getMany() should emit cache:miss and cache:hit events', async ({ assert }) => {
    const emitter = new EventEmitter()
    const { cache } = new CacheFactory().merge({ emitter }).create()

    await cache.setMany([
      { key: 'key1', value: 'value1' },
      { key: 'key3', value: 'value3' },
    ])

    cache.getMany(['key1', 'key2', 'key3', 'key4'])

    const [missEvents, hitEvents] = await Promise.all([
      pEventMultiple(emitter, 'cache:miss', { count: 2 }),
      pEventMultiple(emitter, 'cache:hit', { count: 2 }),
    ])

    assert.deepEqual(missEvents, [
      { key: 'key2', store: 'primary' },
      { key: 'key4', store: 'primary' },
    ])

    assert.deepEqual(hitEvents, [
      { key: 'key1', value: 'value1', store: 'primary' },
      { key: 'key3', value: 'value3', store: 'primary' },
    ])
  })

  test('clear() should emit cache:cleared event', async ({ assert }) => {
    const emitter = new EventEmitter()
    const { cache } = new CacheFactory().merge({ emitter }).create()

    cache.clear()

    const event = await pEvent(emitter, 'cache:cleared')
    assert.deepEqual(event, {
      store: 'primary',
    })
  })

  test('setMany() should emit cache:written events', async ({ assert }) => {
    const emitter = new EventEmitter()
    const { cache } = new CacheFactory().merge({ emitter }).create()

    cache.setMany([
      { key: 'key1', value: 'value1' },
      { key: 'key2', value: 'value2' },
    ])

    const events = await pEventMultiple(emitter, 'cache:written', { count: 2 })
    assert.deepEqual(events, [
      { key: 'key1', store: 'primary', value: 'value1' },
      { key: 'key2', store: 'primary', value: 'value2' },
    ])
  })

  test('deleteMany() should emit cache:deleted events', async ({ assert }) => {
    const emitter = new EventEmitter()
    const { cache } = new CacheFactory().merge({ emitter }).create()

    await cache.setMany([
      { key: 'key1', value: 'value1' },
      { key: 'key2', value: 'value2' },
    ])

    cache.deleteMany(['key1', 'key2'])

    const events = await pEventMultiple(emitter, 'cache:deleted', { count: 2 })
    assert.deepEqual(events, [
      { key: 'key1', store: 'primary' },
      { key: 'key2', store: 'primary' },
    ])
  })

  test('setForever should emit cache:written event', async ({ assert }) => {
    const emitter = new EventEmitter()
    const { cache } = new CacheFactory().merge({ emitter }).create()

    cache.setForever('key', 'value')

    const event = await pEvent(emitter, 'cache:written')
    assert.deepEqual(event, {
      key: 'key',
      value: 'value',
      store: 'primary',
    })
  })

  test('getOrSet should emit cache:hit when value is found', async ({ assert }) => {
    const emitter = new EventEmitter()
    const { cache } = new CacheFactory().merge({ emitter }).create()

    await cache.set('foo', 'bar')

    cache.getOrSet('foo', () => 'baz')

    const event = await pEvent(emitter, 'cache:hit')
    assert.deepEqual(event, {
      key: 'foo',
      value: 'bar',
      store: 'primary',
    })
  })

  test('getOrSet should emit cache:written and cache:miss when value is not found', async ({
    assert,
  }) => {
    const emitter = new EventEmitter()
    const { cache } = new CacheFactory().merge({ emitter }).create()

    cache.getOrSet('foo', () => 'baz')

    const [writtenEvents, missEvents] = await Promise.all([
      pEvent(emitter, 'cache:written'),
      pEvent(emitter, 'cache:miss'),
    ])

    assert.deepEqual(writtenEvents, { key: 'foo', value: 'baz', store: 'primary' })
    assert.deepEqual(missEvents, { key: 'foo', store: 'primary' })
  })
})
