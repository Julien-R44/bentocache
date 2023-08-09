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

import { BentoCache } from '../src/bento_cache.js'
import { memoryDriver } from '../drivers/memory.js'
import { hybridDriver } from '../drivers/hybrid.js'
import { REDIS_CREDENTIALS } from '../test_helpers/index.js'
import { redisBusDriver, redisDriver } from '../drivers/redis.js'
import { BentoCacheFactory } from '../factories/bentocache_factory.js'

test.group('Bento Cache', () => {
  test('should accept EventEmitter or Emittery', async () => {
    // This test only rely type-checking

    new BentoCache({
      default: 'memory',
      stores: { memory: memoryDriver({}) },
      emitter: new EventEmitter(),
    })

    new BentoCache({
      default: 'memory',
      stores: { memory: memoryDriver({}) },
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
        memory: memoryDriver({}),
        redis: redisDriver({ connection: REDIS_CREDENTIALS }),
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
        memory: memoryDriver({}),

        hybrid: hybridDriver({
          local: memoryDriver({ maxSize: 1000 }),
          remote: redisDriver({ connection: REDIS_CREDENTIALS }),
          bus: redisBusDriver(REDIS_CREDENTIALS),
        }),
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
})
