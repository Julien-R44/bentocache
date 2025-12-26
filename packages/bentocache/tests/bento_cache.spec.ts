import { Redis } from 'ioredis'
import { test } from '@japa/runner'

import { bentostore } from '../src/bento_store.js'
import { BentoCache } from '../src/bento_cache.js'
import { REDIS_CREDENTIALS } from './helpers/index.js'
import { memoryDriver } from '../src/drivers/memory.js'
import { redisBusDriver, redisDriver } from '../src/drivers/redis.js'
import { BentoCacheFactory } from '../factories/bentocache_factory.js'

test.group('Bento Cache', () => {
  test('Subscribe to an event', async ({ assert }) => {
    assert.plan(2)

    const { bento } = new BentoCacheFactory().create()

    bento.on('cache:hit', (event) => {
      assert.equal(event.key, 'foo')
      assert.equal(event.value, 'bar')
    })

    await bento.set({ key: 'foo', value: 'bar' })
    await bento.get({ key: 'foo' })
  })

  test('Unsubscribe from an event', async ({ assert }) => {
    const { bento } = new BentoCacheFactory().create()

    const listener = () => assert.fail()

    bento.on('cache:hit', listener)
    bento.off('cache:hit', listener)

    await bento.set({ key: 'foo', value: 'bar' })
    await bento.get({ key: 'foo' })
  })

  test('instances of cache should be cached and re-used', async ({ assert }) => {
    const bento = new BentoCache({
      default: 'memory',
      stores: {
        memory: bentostore().useL1Layer(memoryDriver({})),
        redis: bentostore().useL2Layer(redisDriver({ connection: REDIS_CREDENTIALS })),
      },
    })

    const memory = bento.use('memory')
    assert.equal(memory, bento.use('memory'))

    const redis = bento.use('redis')
    assert.equal(redis, bento.use('redis'))
    assert.equal(memory, bento.use('memory'))

    await bento.disconnectAll()
  })

  test('create store with multiple layers', async ({ assert, cleanup }) => {
    const bento = new BentoCache({
      default: 'memory',
      stores: {
        memory: bentostore().useL1Layer(memoryDriver({})),

        multi: bentostore()
          .useL1Layer(memoryDriver({}))
          .useL2Layer(redisDriver({ connection: REDIS_CREDENTIALS }))
          .useBus(redisBusDriver({ connection: REDIS_CREDENTIALS })),
      },
    })

    cleanup(() => bento.disconnectAll())

    await bento.use('multi').set({ key: 'foo', value: 'bar' })

    assert.equal(await bento.use('multi').get({ key: 'foo' }), 'bar')
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
    const { bento } = new BentoCacheFactory().merge({ logger }).create()
    cleanup(() => bento.disconnectAll())

    assert.isAbove(logger.loggedMessages.length, 0)
  })

  test('use custom prefix per store', async ({ assert, cleanup }) => {
    const redis = new Redis(REDIS_CREDENTIALS)
    const bento = new BentoCache({
      default: 'a1',
      stores: {
        a1: bentostore().useL2Layer(redisDriver({ connection: REDIS_CREDENTIALS, prefix: 'one' })),
        a2: bentostore().useL2Layer(redisDriver({ connection: REDIS_CREDENTIALS, prefix: 'two' })),
      },
    })

    cleanup(async () => {
      redis.disconnect()
      await bento.disconnectAll()
    })

    await bento.use('a1').set({ key: 'foo', value: 'bar' })
    await bento.use('a2').set({ key: 'foo', value: 'baz' })

    assert.include(await redis.get('one:foo'), '"bar"')
    assert.include(await redis.get('two:foo'), '"baz"')
  })

  test('use default options', async ({ assert, cleanup }) => {
    const redis = new Redis(REDIS_CREDENTIALS)
    const bento = new BentoCache({
      default: 'a1',
      ttl: '12h',
      grace: '24h',
      stores: {
        a1: bentostore({ grace: '12h' }).useL2Layer(
          redisDriver({ connection: REDIS_CREDENTIALS, prefix: 'one' }),
        ),

        a2: bentostore().useL2Layer(redisDriver({ connection: REDIS_CREDENTIALS, prefix: 'two' })),
      },
    })

    cleanup(async () => {
      redis.disconnect()
      await bento.clearAll()
      await bento.disconnectAll()
    })

    await bento.use('a1').set({ key: 'foo', value: 'bar' })
    await bento.use('a2').set({ key: 'foo', value: 'baz' })

    const a1Ttl = await redis.ttl('one:foo')
    const a2Ttl = await redis.ttl('two:foo')

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
        a1: bentostore({ grace: '6h' }).useL2Layer(
          redisDriver({ connection: REDIS_CREDENTIALS, prefix: 'one' }),
        ),
        a2: bentostore({ grace: '12h' }).useL2Layer(
          redisDriver({ connection: REDIS_CREDENTIALS, prefix: 'two' }),
        ),
      },
    })

    cleanup(async () => {
      redis.disconnect()
      await bento.clear()
      await bento.disconnectAll()
    })

    await bento.use('a1').set({ key: 'foo', value: 'bar' })
    await bento.use('a2').set({ key: 'foo', value: 'baz' })

    const a1Ttl = await redis.ttl('one:foo')
    const a2Ttl = await redis.ttl('two:foo')

    assert.isAbove(a1Ttl, 6 * 60 * 60 - 1)
    assert.isAbove(a2Ttl, 12 * 60 * 60 - 1)
  })

  test('able to register a plugin', async ({ assert }) => {
    assert.plan(2)

    new BentoCache({
      default: 'memory',
      stores: {
        memory: bentostore().useL1Layer(memoryDriver({})),
      },
      plugins: [
        {
          register(bentocache) {
            assert.instanceOf(bentocache, BentoCache)
            assert.isDefined(bentocache.use('memory'))
          },
        },
      ],
    })
  })

  test('able to register multiple plugins', async ({ assert }) => {
    assert.plan(4)

    new BentoCache({
      default: 'memory',
      stores: {
        memory: bentostore().useL1Layer(memoryDriver({})),
      },
      plugins: [
        {
          register(bentocache) {
            assert.instanceOf(bentocache, BentoCache)
            assert.isDefined(bentocache.use('memory'))
          },
        },
        {
          register(bentocache) {
            assert.instanceOf(bentocache, BentoCache)
            assert.isDefined(bentocache.use('memory'))
          },
        },
      ],
    })
  })

  test('should expose the default store name', async ({ assert }) => {
    const { bento } = new BentoCacheFactory().create()

    assert.equal(bento.defaultStoreName, 'primary')
  })

  test('should not accept some options', async () => {
    const opts = {
      default: 'memory',
      stores: { memory: bentostore().useL1Layer(memoryDriver({})) },
    }

    new BentoCache({
      ...opts,
      // @ts-expect-error invalid option
      tags: ['foo'],
    })

    new BentoCache({
      ...opts,
      // @ts-expect-error invalid option
      skipBusNotify: true,
    })

    new BentoCache({
      ...opts,
      // @ts-expect-error invalid option
      skipL2Write: true,
    })
  })
})
