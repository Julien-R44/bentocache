import { test } from '@japa/runner'
import { setTimeout } from 'node:timers/promises'

import { cacheOperation } from '../src/tracing_channels.js'
import { CacheFactory } from '../factories/cache_factory.js'
import type { CacheOperationMessage } from '../src/types/tracing_channels.js'

/**
 * Helper to collect tracing messages
 */
function createCollector() {
  const messages: { start: CacheOperationMessage[]; end: CacheOperationMessage[] } = {
    start: [],
    end: [],
  }

  const startHandler = (message: unknown) => {
    messages.start.push({ ...(message as CacheOperationMessage) })
  }
  const endHandler = (message: unknown) => {
    messages.end.push({ ...(message as CacheOperationMessage) })
  }

  cacheOperation.start.subscribe(startHandler)
  cacheOperation.asyncEnd.subscribe(endHandler)

  const cleanup = () => {
    cacheOperation.start.unsubscribe(startHandler)
    cacheOperation.asyncEnd.unsubscribe(endHandler)
  }

  const clear = () => {
    messages.start.length = 0
    messages.end.length = 0
  }

  return { messages, cleanup, clear }
}

test.group('Tracing Channels', () => {
  test('traces get operation with cache miss', async ({ assert, cleanup }) => {
    const collector = createCollector()
    cleanup(() => collector.cleanup())

    const { cache } = new CacheFactory().withL1L2Config().create()
    await cache.get({ key: 'nonexistent' })

    assert.lengthOf(collector.messages.start, 1)
    assert.lengthOf(collector.messages.end, 1)

    assert.equal(collector.messages.start[0].operation, 'get')
    assert.equal(collector.messages.start[0].key, 'bentocache:nonexistent')
    assert.equal(collector.messages.start[0].store, 'primary')

    assert.equal(collector.messages.end[0].hit, false)
  })

  test('traces get operation with cache hit on L1', async ({ assert, cleanup }) => {
    const collector = createCollector()
    cleanup(() => collector.cleanup())

    const { cache } = new CacheFactory().withL1L2Config().create()

    await cache.set({ key: 'mykey', value: 'myvalue' })
    collector.clear()

    await cache.get({ key: 'mykey' })

    assert.lengthOf(collector.messages.start, 1)
    assert.lengthOf(collector.messages.end, 1)

    assert.equal(collector.messages.end[0].operation, 'get')
    assert.equal(collector.messages.end[0].hit, true)
    assert.equal(collector.messages.end[0].tier, 'l1')
    assert.equal(collector.messages.end[0].graced, false)
  })

  test('traces set operation', async ({ assert, cleanup }) => {
    const collector = createCollector()
    cleanup(() => collector.cleanup())

    const { cache } = new CacheFactory().withL1L2Config().create()
    await cache.set({ key: 'foo', value: 'bar' })

    assert.lengthOf(collector.messages.start, 1)
    assert.lengthOf(collector.messages.end, 1)

    assert.equal(collector.messages.start[0].operation, 'set')
    assert.equal(collector.messages.start[0].key, 'bentocache:foo')
    assert.equal(collector.messages.start[0].store, 'primary')
  })

  test('traces delete operation', async ({ assert, cleanup }) => {
    const collector = createCollector()
    cleanup(() => collector.cleanup())

    const { cache } = new CacheFactory().withL1L2Config().create()
    await cache.set({ key: 'foo', value: 'bar' })
    collector.clear()

    await cache.delete({ key: 'foo' })

    assert.lengthOf(collector.messages.start, 1)
    assert.lengthOf(collector.messages.end, 1)

    assert.equal(collector.messages.start[0].operation, 'delete')
    assert.equal(collector.messages.start[0].key, 'bentocache:foo')
  })

  test('traces deleteMany operation', async ({ assert, cleanup }) => {
    const collector = createCollector()
    cleanup(() => collector.cleanup())

    const { cache } = new CacheFactory().withL1L2Config().create()
    await cache.set({ key: 'foo', value: 'bar' })
    await cache.set({ key: 'baz', value: 'qux' })
    collector.clear()

    await cache.deleteMany({ keys: ['foo', 'baz'] })

    assert.lengthOf(collector.messages.start, 1)
    assert.lengthOf(collector.messages.end, 1)

    assert.equal(collector.messages.start[0].operation, 'deleteMany')
    assert.deepEqual(collector.messages.start[0].keys, ['bentocache:foo', 'bentocache:baz'])
  })

  test('traces clear operation', async ({ assert, cleanup }) => {
    const collector = createCollector()
    cleanup(() => collector.cleanup())

    const { cache } = new CacheFactory().withL1L2Config().create()

    await cache.clear()

    assert.lengthOf(collector.messages.start, 1)
    assert.lengthOf(collector.messages.end, 1)

    assert.equal(collector.messages.start[0].operation, 'clear')
    assert.equal(collector.messages.start[0].store, 'primary')
  })

  test('traces expire operation', async ({ assert, cleanup }) => {
    const collector = createCollector()
    cleanup(() => collector.cleanup())

    const { cache } = new CacheFactory().withL1L2Config().create()
    await cache.set({ key: 'foo', value: 'bar' })
    collector.clear()

    await cache.expire({ key: 'foo' })

    assert.lengthOf(collector.messages.start, 1)
    assert.lengthOf(collector.messages.end, 1)

    assert.equal(collector.messages.start[0].operation, 'expire')
    assert.equal(collector.messages.start[0].key, 'bentocache:foo')
  })

  test('traces getOrSet with cache hit', async ({ assert, cleanup }) => {
    const collector = createCollector()
    cleanup(() => collector.cleanup())

    const { cache } = new CacheFactory().withL1L2Config().create()
    await cache.set({ key: 'foo', value: 'existing' })
    collector.clear()

    await cache.getOrSet({ key: 'foo', factory: () => 'new' })

    // Should only have a getOrSet trace (hit), no set
    const getOrSetMessages = collector.messages.end.filter((m) => m.operation === 'getOrSet')
    const setMessages = collector.messages.end.filter((m) => m.operation === 'set')

    assert.lengthOf(getOrSetMessages, 1)
    assert.lengthOf(setMessages, 0)

    assert.equal(getOrSetMessages[0].hit, true)
    assert.equal(getOrSetMessages[0].tier, 'l1')
  })

  test('traces getOrSet with cache miss (get + set)', async ({ assert, cleanup }) => {
    const collector = createCollector()
    cleanup(() => collector.cleanup())

    const { cache } = new CacheFactory().withL1L2Config().create()

    await cache.getOrSet({ key: 'newkey', factory: () => 'newvalue' })

    const getOrSetMessages = collector.messages.end.filter((m) => m.operation === 'getOrSet')
    const factoryMessages = collector.messages.end.filter((m) => m.operation === 'factory')
    const setMessages = collector.messages.end.filter((m) => m.operation === 'set')

    assert.lengthOf(getOrSetMessages, 1)
    assert.lengthOf(factoryMessages, 1)
    assert.lengthOf(setMessages, 1)

    assert.equal(getOrSetMessages[0].hit, false)
    assert.equal(setMessages[0].key, 'bentocache:newkey')
  })

  test('traces namespaced operations with full key', async ({ assert, cleanup }) => {
    const collector = createCollector()
    cleanup(() => collector.cleanup())

    const { cache } = new CacheFactory().withL1L2Config().create()

    await cache.namespace('users').set({ key: '123', value: 'john' })

    assert.equal(collector.messages.start[0].key, 'bentocache:users:123')
  })

  test('traces graced get operation', async ({ assert, cleanup }) => {
    const collector = createCollector()
    cleanup(() => collector.cleanup())

    const { cache } = new CacheFactory().withL1L2Config().merge({ grace: '2h' }).create()

    await cache.set({ key: 'foo', value: 'bar', ttl: '10ms' })
    await setTimeout(50)
    collector.clear()

    await cache.get({ key: 'foo' })

    assert.equal(collector.messages.end[0].hit, true)
    assert.equal(collector.messages.end[0].graced, true)
  })
})
