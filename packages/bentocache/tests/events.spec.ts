import { test } from '@japa/runner'
import EventEmitter from 'node:events'
import { sleep } from '@julr/utils/misc'
import { pEvent, pEventMultiple } from 'p-event'
import { MemoryTransport } from '@boringnode/bus/transports/memory'

import { throwingFactory } from './helpers/index.js'
import { ChaosBus } from './helpers/chaos/chaos_bus.js'
import { CacheBusMessageType } from '../src/types/bus.js'
import { CacheFactory } from '../factories/cache_factory.js'

test.group('Cache events', () => {
  test('emit cache:miss event when get() inexistent key', async ({ assert }) => {
    const emitter = new EventEmitter()
    const { cache } = new CacheFactory().withL1L2Config().merge({ emitter }).create()

    cache.get({ key: 'key' })
    const event = await pEvent(emitter, 'cache:miss')

    assert.deepEqual(event, { key: 'key', store: 'primary' })
  })

  test('emit cache:hit event when get() existing key', async ({ assert }) => {
    const emitter = new EventEmitter()
    const { cache } = new CacheFactory().withL1L2Config().merge({ emitter }).create()

    const eventPromise = pEvent(emitter, 'cache:hit')

    await cache.set({ key: 'key', value: 'value' })
    cache.get({ key: 'key' })

    const event = await eventPromise
    assert.deepEqual(event, {
      key: 'key',
      value: 'value',
      store: 'primary',
      graced: false,
      layer: 'l1',
    })
  })

  test('emit cache:written event when calling set()', async ({ assert }) => {
    const emitter = new EventEmitter()
    const { cache } = new CacheFactory().withL1L2Config().merge({ emitter }).create()

    cache.set({ key: 'key', value: 'value' })

    const event = await pEvent(emitter, 'cache:written')
    assert.deepEqual(event, { key: 'key', value: 'value', store: 'primary' })
  })

  test('emit cache:deleted event when calling delete()', async ({ assert }) => {
    const emitter = new EventEmitter()
    const { cache } = new CacheFactory().withL1L2Config().merge({ emitter }).create()

    await cache.set({ key: 'key', value: 'value' })
    cache.delete({ key: 'key' })

    const event = await pEvent(emitter, 'cache:deleted')
    assert.deepEqual(event, { key: 'key', store: 'primary' })
  })

  test('emit cache:deleted even if bus is failing', async ({ assert }) => {
    assert.plan(1)

    const emitter = new EventEmitter()
    const bus = new ChaosBus(new MemoryTransport())
    const { cache } = new CacheFactory()
      .merge({ busDriver: bus, emitter })
      .withL1L2Config()
      .create()

    bus.alwaysThrow()
    cache.delete({ key: 'key' })

    const event = await pEvent(emitter, 'cache:deleted')
    assert.deepEqual(event, { key: 'key', store: 'primary' })
  })

  test('pull() emit cache:deleted and cache:hit events', async ({ assert }) => {
    const emitter = new EventEmitter()
    const { cache } = new CacheFactory().withL1L2Config().merge({ emitter }).create()

    const promises = Promise.all([pEvent(emitter, 'cache:deleted'), pEvent(emitter, 'cache:hit')])
    await cache.set({ key: 'key', value: 'value' })
    cache.pull('key')

    const [deletedEvent, hitEvent] = await promises

    assert.deepEqual(deletedEvent, { key: 'key', store: 'primary' })
    assert.deepEqual(hitEvent, {
      key: 'key',
      value: 'value',
      store: 'primary',
      graced: false,
      layer: 'l1',
    })
  })

  test('clear() emit cache:cleared event', async ({ assert }) => {
    const emitter = new EventEmitter()
    const { cache } = new CacheFactory().withL1L2Config().merge({ emitter }).create()

    cache.clear()

    const event = await pEvent(emitter, 'cache:cleared')
    assert.deepEqual(event, { store: 'primary' })
  })

  test('deleteMany() emit cache:deleted events', async ({ assert }) => {
    const emitter = new EventEmitter()
    const { cache } = new CacheFactory().withL1L2Config().merge({ emitter }).create()

    await cache.set({ key: 'key1', value: 'value1' })
    await cache.set({ key: 'key2', value: 'value2' })

    cache.deleteMany({ keys: ['key1', 'key2'] })

    const events = await pEventMultiple(emitter, 'cache:deleted', { count: 2 })
    assert.deepEqual(events, [
      { key: 'key1', store: 'primary' },
      { key: 'key2', store: 'primary' },
    ])
  })

  test('setForever emit cache:written event', async ({ assert }) => {
    const emitter = new EventEmitter()
    const { cache } = new CacheFactory().withL1L2Config().merge({ emitter }).create()

    cache.setForever({ key: 'key', value: 'value' })

    const event = await pEvent(emitter, 'cache:written')
    assert.deepEqual(event, { key: 'key', value: 'value', store: 'primary' })
  })

  test('getOrSet emit cache:hit when value is found', async ({ assert }) => {
    const emitter = new EventEmitter()
    const { cache } = new CacheFactory().withL1L2Config().merge({ emitter }).create()
    const event = pEvent(emitter, 'cache:hit')

    await cache.set({ key: 'foo', value: 'bar' })
    cache.getOrSet({ key: 'foo', factory: () => 'baz' })

    assert.deepEqual(await event, {
      key: 'foo',
      value: 'bar',
      store: 'primary',
      graced: false,
      layer: 'l1',
    })
  })

  test('getOrSet emit cache:written and cache:miss when value is not found', async ({ assert }) => {
    const emitter = new EventEmitter()
    const { cache } = new CacheFactory().withL1L2Config().merge({ emitter }).create()

    cache.getOrSet({ key: 'foo', factory: () => 'baz' })

    const [writtenEvents, missEvents] = await Promise.all([
      pEvent(emitter, 'cache:written'),
      pEvent(emitter, 'cache:miss'),
    ])

    assert.deepEqual(writtenEvents, { key: 'foo', value: 'baz', store: 'primary' })
    assert.deepEqual(missEvents, { key: 'foo', store: 'primary' })
  })

  test('emit event when publish a message on bus', async ({ assert }) => {
    const emitter = new EventEmitter()
    const { cache } = new CacheFactory().withL1L2Config().merge({ emitter }).create()

    cache.getOrSet({ key: 'foo', factory: () => 'baz' })

    const event = await pEvent<any, any>(emitter, 'bus:message:published')

    assert.deepInclude(event.message, { keys: ['foo'], type: CacheBusMessageType.Set })
  })

  test('emit event when receive a message on bus', async ({ assert }) => {
    const emitter = new EventEmitter()
    new CacheFactory().withL1L2Config().merge({ emitter }).create()
    const [cache2] = new CacheFactory().withL1L2Config().create()

    cache2.getOrSet({ key: 'foo', factory: () => 'baz' })

    const event = await pEvent<any, any>(emitter, 'bus:message:received')

    assert.deepInclude(event.message, {
      keys: ['foo'],
      type: CacheBusMessageType.Set,
    })
  })

  test('a graced value should be marked as graced with get', async ({ assert }) => {
    const emitter = new EventEmitter()
    const { cache } = new CacheFactory().withL1L2Config().merge({ emitter, grace: '2h' }).create()

    await cache.set({ key: 'foo', value: 'bar', ttl: '10ms' })
    await sleep(50)

    cache.get({ key: 'foo' })

    const event = await pEvent<any, any>(emitter, 'cache:hit')

    assert.isTrue(event.graced)
  })

  test('a graced value should be marked as graced with getOrSet', async ({ assert }) => {
    const emitter = new EventEmitter()
    const { cache } = new CacheFactory().withL1L2Config().merge({ emitter, grace: '2h' }).create()

    await cache.set({ key: 'foo', value: 'bar', ttl: '10ms' })
    await sleep(50)

    cache.getOrSet({ key: 'foo', factory: throwingFactory('foo') })

    const event = await pEvent<any, any>(emitter, 'cache:hit')

    assert.isTrue(event.graced)
  })
})
