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
import { CacheBusMessageType } from '../src/types/bus.js'

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
    assert.deepEqual(event, { key: 'key', store: 'primary' })
  })

  // test('should emit cache:deleted even if bus is failing', async ({ assert }) => {
  //   const emitter = new EventEmitter()
  //   const { cache } = new CacheFactory()
  //     .merge({ busDriver: new ChaosBus(new MemoryBus()) })
  //     .withHybridConfig()
  //     .create()
  // })

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

  test('clear() should emit cache:cleared event', async ({ assert }) => {
    const emitter = new EventEmitter()
    const { cache } = new CacheFactory().merge({ emitter }).create()

    cache.clear()

    const event = await pEvent(emitter, 'cache:cleared')
    assert.deepEqual(event, {
      store: 'primary',
    })
  })

  test('deleteMany() should emit cache:deleted events', async ({ assert }) => {
    const emitter = new EventEmitter()
    const { cache } = new CacheFactory().merge({ emitter }).create()

    await cache.set('key1', 'value1')
    await cache.set('key2', 'value2')

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

  test('should emit event when publish a message', async ({ assert }) => {
    const emitter = new EventEmitter()
    const { cache } = new CacheFactory().withHybridConfig().merge({ emitter }).create()

    cache.getOrSet('foo', () => 'baz')

    const event = await pEvent(emitter, 'bus:message:published')

    assert.isDefined(event.message.busId)
    assert.deepInclude(event.message, {
      keys: ['foo'],
      type: CacheBusMessageType.Set,
    })
  })

  test('should emit event when receive a message', async ({ assert }) => {
    const emitter = new EventEmitter()
    new CacheFactory().withHybridConfig().merge({ emitter }).create()
    const [cache2] = new CacheFactory().withHybridConfig().create()

    cache2.getOrSet('foo', () => 'baz')

    const event = await pEvent(emitter, 'bus:message:received')

    assert.isDefined(event.message.busId)
    assert.deepInclude(event.message, {
      keys: ['foo'],
      type: CacheBusMessageType.Set,
    })
  })
})
