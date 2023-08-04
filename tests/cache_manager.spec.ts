import Emittery from 'emittery'
import { test } from '@japa/runner'
import EventEmitter from 'node:events'

import { CacheManager } from '../src/cache_manager.js'
import { Lru } from '../src/drivers/lru.js'

test.group('Cache Manager', () => {
  test('should accept EventEmitter or Emittery', async () => {
    // This test only rely type-checking
    new CacheManager({ default: 'memory', list: { memory: () => ({}) as any } }, new EventEmitter())
    new CacheManager({ default: 'memory', list: { memory: () => ({}) as any } }, new Emittery())
  })

  test('Subscribe to an event', async ({ assert }) => {
    assert.plan(2)

    const manager = new CacheManager({
      default: 'memory',
      list: {
        memory: () => new Lru({ maxSize: 100, ttl: 10000, prefix: 'test' }),
      },
    })

    manager.on('cache:hit', (event) => {
      assert.equal(event.key, 'foo')
      assert.equal(event.value, 'bar')
    })

    await manager.set('foo', 'bar')
    await manager.get('foo')
  })

  test('Unsubscribe from an event', async ({ assert }) => {
    const manager = new CacheManager({
      default: 'memory',
      list: {
        memory: () => new Lru({ maxSize: 100, ttl: 10000, prefix: 'test' }),
      },
    })

    const listener = () => assert.fail()

    manager.on('cache:hit', listener)
    manager.off('cache:hit', listener)

    await manager.set('foo', 'bar')
    await manager.get('foo')
  })
})
