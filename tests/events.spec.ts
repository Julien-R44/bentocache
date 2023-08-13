/*
 * @quakjs/bentocache
 *
 * (c) Quak
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { test } from '@japa/runner'
import EventEmitter from 'node:events'
import { pEvent, pEventMultiple } from 'p-event'
import { setTimeout } from 'node:timers/promises'

import { CacheBusMessageType } from '../src/types/bus.js'
import { throwingFactory } from '../test_helpers/index.js'
import { MemoryBus } from '../src/bus/drivers/memory_bus.js'
import { CacheFactory } from '../factories/cache_factory.js'
import { ChaosBus } from '../test_helpers/chaos/chaos_bus.js'

test.group('Cache events', () => {
  test('emit cache:miss event when get() inexistent key', async ({ assert }) => {
    const emitter = new EventEmitter()
    const { cache } = new CacheFactory().merge({ emitter }).create()

    cache.get('key')
    const event = await pEvent(emitter, 'cache:miss')

    assert.deepEqual(event, { key: 'key', store: 'primary' })
  })

  test('emit cache:hit event when get() existing key', async ({ assert }) => {
    const emitter = new EventEmitter()
    const { cache } = new CacheFactory().merge({ emitter }).create()

    await cache.set('key', 'value')
    cache.get('key')

    const event = await pEvent(emitter, 'cache:hit')
    assert.deepEqual(event, { key: 'key', value: 'value', store: 'primary', graced: false })
  })

  test('emit cache:written event when calling set()', async ({ assert }) => {
    const emitter = new EventEmitter()
    const { cache } = new CacheFactory().merge({ emitter }).create()

    cache.set('key', 'value')

    const event = await pEvent(emitter, 'cache:written')
    assert.deepEqual(event, { key: 'key', value: 'value', store: 'primary' })
  })

  test('emit cache:deleted event when calling delete()', async ({ assert }) => {
    const emitter = new EventEmitter()
    const { cache } = new CacheFactory().merge({ emitter }).create()

    await cache.set('key', 'value')
    cache.delete('key')

    const event = await pEvent(emitter, 'cache:deleted')
    assert.deepEqual(event, { key: 'key', store: 'primary' })
  })

  test('emit cache:deleted even if bus is failing', async ({ assert }) => {
    assert.plan(1)

    const emitter = new EventEmitter()
    const bus = new ChaosBus(new MemoryBus())
    const { cache } = new CacheFactory()
      .merge({ busDriver: bus, emitter })
      .withHybridConfig()
      .create()

    bus.alwaysThrow()
    cache.delete('key')

    const event = await pEvent(emitter, 'cache:deleted')
    assert.deepEqual(event, { key: 'key', store: 'primary' })
  })

  test('pull() emit cache:deleted and cache:hit events', async ({ assert }) => {
    const emitter = new EventEmitter()
    const { cache } = new CacheFactory().merge({ emitter }).create()

    await cache.set('key', 'value')
    cache.pull('key')

    const [deletedEvent, hitEvent] = await Promise.all([
      pEvent(emitter, 'cache:deleted'),
      pEvent(emitter, 'cache:hit'),
    ])

    assert.deepEqual(deletedEvent, { key: 'key', store: 'primary' })

    assert.deepEqual(hitEvent, { key: 'key', value: 'value', store: 'primary', graced: false })
  })

  test('clear() emit cache:cleared event', async ({ assert }) => {
    const emitter = new EventEmitter()
    const { cache } = new CacheFactory().merge({ emitter }).create()

    cache.clear()

    const event = await pEvent(emitter, 'cache:cleared')
    assert.deepEqual(event, { store: 'primary' })
  })

  test('deleteMany() emit cache:deleted events', async ({ assert }) => {
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

  test('setForever emit cache:written event', async ({ assert }) => {
    const emitter = new EventEmitter()
    const { cache } = new CacheFactory().merge({ emitter }).create()

    cache.setForever('key', 'value')

    const event = await pEvent(emitter, 'cache:written')
    assert.deepEqual(event, { key: 'key', value: 'value', store: 'primary' })
  })

  test('getOrSet emit cache:hit when value is found', async ({ assert }) => {
    const emitter = new EventEmitter()
    const { cache } = new CacheFactory().merge({ emitter }).create()

    await cache.set('foo', 'bar')

    cache.getOrSet('foo', () => 'baz')

    const event = await pEvent(emitter, 'cache:hit')
    assert.deepEqual(event, { key: 'foo', value: 'bar', store: 'primary', graced: false })
  })

  test('getOrSet emit cache:written and cache:miss when value is not found', async ({ assert }) => {
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

  test('emit event when publish a message on bus', async ({ assert }) => {
    const emitter = new EventEmitter()
    const { cache } = new CacheFactory().withHybridConfig().merge({ emitter }).create()

    cache.getOrSet('foo', () => 'baz')

    const event = await pEvent(emitter, 'bus:message:published')

    assert.isDefined(event.message.busId)
    assert.deepInclude(event.message, { keys: ['foo'], type: CacheBusMessageType.Set })
  })

  test('emit event when receive a message on bus', async ({ assert }) => {
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

  test('a graced value should be marked as graced with get', async ({ assert }) => {
    const emitter = new EventEmitter()
    const { cache } = new CacheFactory()
      .merge({
        emitter,
        gracePeriod: { enabled: true, duration: '2h' },
      })
      .create()

    await cache.set('foo', 'bar', { ttl: '10ms' })
    await setTimeout(50)

    cache.get('foo')

    const event = await pEvent(emitter, 'cache:hit')

    assert.isTrue(event.graced)
  })

  test('a graced value should be marked as graced with getOrSet', async ({ assert }) => {
    const emitter = new EventEmitter()
    const { cache } = new CacheFactory()
      .merge({
        emitter,
        gracePeriod: { enabled: true, duration: '2h' },
      })
      .create()

    await cache.set('foo', 'bar', { ttl: '10ms' })
    await setTimeout(50)

    cache.getOrSet('foo', throwingFactory('foo'))

    const event = await pEvent(emitter, 'cache:hit')

    assert.isTrue(event.graced)
  })
})
