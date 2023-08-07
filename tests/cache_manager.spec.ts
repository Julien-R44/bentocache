/*
 * @adonisjs/cache
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import Emittery from 'emittery'
import { test } from '@japa/runner'
import EventEmitter from 'node:events'

import { CacheManager } from '../src/cache_manager.js'
import { memoryDriver } from '../src/drivers/memory.js'
import type { DriverCommonOptions } from '../src/types/main.js'
import { redisDriver } from '../src/drivers/redis.js'
import { REDIS_CREDENTIALS } from '../test_helpers/index.js'

test.group('Cache Manager', () => {
  test('should accept EventEmitter or Emittery', async () => {
    // This test only rely type-checking
    new CacheManager(
      { default: 'memory', stores: { memory: memoryDriver({}) } },
      new EventEmitter()
    )
    new CacheManager({ default: 'memory', stores: { memory: memoryDriver({}) } }, new Emittery())
  })

  test('Subscribe to an event', async ({ assert }) => {
    assert.plan(2)

    const manager = new CacheManager({
      default: 'memory',
      stores: { memory: memoryDriver({}) },
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
      stores: { memory: memoryDriver({}) },
    })

    const listener = () => assert.fail()

    manager.on('cache:hit', listener)
    manager.off('cache:hit', listener)

    await manager.set('foo', 'bar')
    await manager.get('foo')
  })

  test('should use default ttl when not provided', async ({ assert }) => {
    assert.plan(2)

    class MyDriver {
      constructor(options: DriverCommonOptions) {
        assert.equal(options.ttl, 30000)
      }
    }

    class MyDriver2 {
      constructor(options: DriverCommonOptions) {
        assert.equal(options.ttl, 20000)
      }
    }

    const manager = new CacheManager({
      default: 'memory',
      ttl: 200,
      stores: {
        memory: {
          driver: (config: any) => new MyDriver(config) as any,
          options: { ttl: 30000 },
        },
        other: {
          driver: (config: any) => new MyDriver2(config) as any,
          options: { ttl: 20000 },
        },
      },
    })

    manager.use('memory')
    manager.use('other')
  })

  test('should convert default ttl to ms', async ({ assert }) => {
    assert.plan(1)

    class MyDriver {
      constructor(options: DriverCommonOptions) {
        assert.equal(options.ttl, 30000)
      }
    }

    const manager = new CacheManager({
      default: 'memory',
      ttl: '30s',
      stores: {
        memory: {
          driver: (config: any) => new MyDriver(config) as any,
          options: {},
        },
      },
    })

    manager.use('memory')
  })

  test('should convert driver ttl to ms', async ({ assert }) => {
    assert.plan(1)

    class MyDriver {
      constructor(options: DriverCommonOptions) {
        assert.equal(options.ttl, 30000)
      }
    }

    const manager = new CacheManager({
      default: 'memory',
      ttl: 200,
      stores: {
        memory: {
          driver: (config: any) => new MyDriver(config) as any,
          options: { ttl: '30s' },
        },
      },
    })

    manager.use('memory')
  })

  test('should use default prefix when not provided', async ({ assert }) => {
    assert.plan(2)

    class MyDriver {
      constructor(options: DriverCommonOptions) {
        assert.equal(options.prefix, 'test')
      }
    }

    class MyDriver2 {
      constructor(options: DriverCommonOptions) {
        assert.equal(options.prefix, 'other')
      }
    }

    const manager = new CacheManager({
      default: 'memory',
      prefix: 'test',
      stores: {
        memory: {
          driver: (config: any) => new MyDriver(config) as any,
          options: {},
        },
        other: {
          driver: (config: any) => new MyDriver2(config) as any,
          options: { prefix: 'other' },
        },
      },
    })

    manager.use('memory')
    manager.use('other')
  })

  test('instances of cache should be cached and re-used', async ({ assert }) => {
    const manager = new CacheManager({
      default: 'memory',
      stores: {
        memory: memoryDriver({}),
        redis: redisDriver({ connection: REDIS_CREDENTIALS }),
      },
    })

    const memory = manager.use('memory')
    assert.equal(memory, manager.use('memory'))

    const redis = manager.use('redis')
    assert.equal(redis, manager.use('redis'))
    assert.equal(memory, manager.use('memory'))

    await manager.disconnectAll()
  })
})
