/*
 * @blizzle/bentocache
 *
 * (c) Blizzle
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import Emittery from 'emittery'
import { Redis } from 'ioredis'
import { test } from '@japa/runner'
import EventEmitter from 'node:events'

import { BentoCache } from '../src/bento_cache.js'
import { lruDriver } from '../drivers/lru.js'
import { hybridDriver } from '../drivers/hybrid.js'
import { REDIS_CREDENTIALS } from '../test_helpers/index.js'
import { redisBusDriver, redisDriver } from '../drivers/redis.js'
import { BentoCacheFactory } from '../factories/bentocache_factory.js'

test.group('Bento Cache', () => {
  test('should accept EventEmitter or Emittery', async ({ expectTypeOf }) => {
    expectTypeOf(BentoCache).toBeConstructibleWith({
      default: 'memory',
      stores: { memory: { driver: lruDriver({}) } },
      emitter: new EventEmitter(),
    })

    expectTypeOf(BentoCache).toBeConstructibleWith({
      default: 'memory',
      stores: { memory: { driver: lruDriver({}) } },
      emitter: new Emittery(),
    })
  })

  test('Subscribe to an event', async ({ assert }) => {
    assert.plan(2)

    const { bento } = new BentoCacheFactory().create()

    bento.on('cache:hit', (event) => {
      assert.equal(event.key, 'foo')
      assert.equal(event.value, 'bar')
    })

    await bento.set('foo', 'bar')
    await bento.get('foo')
  })

  test('Unsubscribe from an event', async ({ assert }) => {
    const { bento } = new BentoCacheFactory().create()

    const listener = () => assert.fail()

    bento.on('cache:hit', listener)
    bento.off('cache:hit', listener)

    await bento.set('foo', 'bar')
    await bento.get('foo')
  })

  test('instances of cache should be cached and re-used', async ({ assert }) => {
    const bento = new BentoCache({
      default: 'memory',
      stores: {
        memory: { driver: lruDriver({}) },
        redis: { driver: redisDriver({ connection: REDIS_CREDENTIALS }) },
      },
    })

    const memory = bento.use('memory')
    assert.equal(memory, bento.use('memory'))

    const redis = bento.use('redis')
    assert.equal(redis, bento.use('redis'))
    assert.equal(memory, bento.use('memory'))

    await bento.disconnectAll()
  })

  test('create store with hybrid driver', async ({ assert, cleanup }) => {
    const bento = new BentoCache({
      default: 'memory',
      stores: {
        memory: {
          driver: lruDriver({}),
        },

        hybrid: {
          driver: hybridDriver({
            local: lruDriver({ maxSize: 1000 }),
            remote: redisDriver({ connection: REDIS_CREDENTIALS }),
            bus: redisBusDriver({ connection: REDIS_CREDENTIALS }),
          }),
        },
      },
    })

    cleanup(() => bento.disconnectAll())

    await bento.use('hybrid').set('foo', 'bar')

    assert.equal(await bento.use('hybrid').get('foo'), 'bar')
  })

  test('use custom logger', async ({ assert, cleanup }) => {
    const logger = {
      loggedMessages: [] as any,
      child: () => logger,
      log: (level: string, message: any) => logger.loggedMessages.push({ level, message }),
      trace: (message: any) => logger.log('trace', message),
      debug: (message: any) => logger.log('debug', message),
    }

    // @ts-expect-error too lazy to implement the entire interface
    const { bento } = new BentoCacheFactory().merge({ logger: logger }).create()
    cleanup(() => bento.disconnectAll())

    assert.isAbove(logger.loggedMessages.length, 0)
  })

  test('use custom prefix per store', async ({ assert, cleanup }) => {
    const redis = new Redis(REDIS_CREDENTIALS)
    const bento = new BentoCache({
      default: 'a1',
      stores: {
        a1: { prefix: 'memory', driver: redisDriver({ connection: REDIS_CREDENTIALS }) },
        a2: { prefix: 'redis', driver: redisDriver({ connection: REDIS_CREDENTIALS }) },
      },
    })

    cleanup(async () => {
      redis.disconnect()
      await bento.disconnectAll()
    })

    await bento.use('a1').set('foo', 'bar')
    await bento.use('a2').set('foo', 'baz')

    assert.include(await redis.get('memory:foo'), '"bar"')
    assert.include(await redis.get('redis:foo'), '"baz"')
  })

  test('use default options', async ({ assert, cleanup }) => {
    const redis = new Redis(REDIS_CREDENTIALS)
    const bento = new BentoCache({
      default: 'a1',
      ttl: '12h',
      gracePeriod: {
        enabled: true,
        duration: '24h',
      },
      stores: {
        a1: {
          driver: redisDriver({ connection: REDIS_CREDENTIALS }),
          prefix: 'memory',
          gracePeriod: { enabled: true, duration: '12h' },
        },
        a2: {
          driver: redisDriver({ connection: REDIS_CREDENTIALS }),
          prefix: 'redis',
        },
      },
    })

    cleanup(async () => {
      redis.disconnect()
      await bento.clearAll()
      await bento.disconnectAll()
    })

    await bento.use('a1').set('foo', 'bar')
    await bento.use('a2').set('foo', 'baz')

    const a1Ttl = await redis.ttl('memory:foo')
    const a2Ttl = await redis.ttl('redis:foo')

    // a1 TTL should be 12h
    assert.closeTo(a1Ttl, 12 * 60 * 60, 1)

    // a2 ttl should be 24h
    assert.closeTo(a2Ttl, 24 * 60 * 60, 1)
  })

  test('use custom grace period per store', async ({ assert, cleanup }) => {
    const redis = new Redis(REDIS_CREDENTIALS)
    const bento = new BentoCache({
      default: 'a1',
      stores: {
        a1: {
          driver: redisDriver({ connection: REDIS_CREDENTIALS }),
          prefix: 'memory',
          gracePeriod: { enabled: true, duration: '6h' },
        },
        a2: {
          driver: redisDriver({ connection: REDIS_CREDENTIALS }),
          prefix: 'redis',
          gracePeriod: { enabled: true, duration: '12h' },
        },
      },
    })

    cleanup(async () => {
      redis.disconnect()
      await bento.clear()
      await bento.disconnectAll()
    })

    await bento.use('a1').set('foo', 'bar')
    await bento.use('a2').set('foo', 'baz')

    const a1Ttl = await redis.ttl('memory:foo')
    const a2Ttl = await redis.ttl('redis:foo')

    assert.isAbove(a1Ttl, 6 * 60 * 60 - 1)
    assert.isAbove(a2Ttl, 12 * 60 * 60 - 1)
  })
})
