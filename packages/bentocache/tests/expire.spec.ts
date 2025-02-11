import { pEvent } from 'p-event'
import { test } from '@japa/runner'
import EventEmitter from 'node:events'

import { CacheFactory } from '../factories/cache_factory.js'

test.group('Expire', () => {
  test('[{name}] - expire a key from the cache')
    .with([
      {
        name: 'l1',
        factory: () => new CacheFactory().merge({ grace: '2m' }).withMemoryL1().create(),
      },
      {
        name: 'l2',
        factory: () => new CacheFactory().merge({ grace: '2m' }).withRedisL2().create(),
      },
      {
        name: 'l1/l2',
        factory: () => new CacheFactory().merge({ grace: '2m' }).withL1L2Config().create(),
      },
    ])
    .run(async ({ assert }, { factory }) => {
      const { cache } = factory()

      await cache.set({ key: 'hello', value: 'world' })
      await cache.expire({ key: 'hello' })

      const r1 = await cache.get({ key: 'hello', grace: false })
      const r2 = await cache.get({ key: 'hello' })

      assert.deepEqual(r1, undefined)
      assert.deepEqual(r2, 'world')
    })

  test('expire should publish an message to the bus', async ({ assert }) => {
    const [cache1] = new CacheFactory().merge({ grace: '3m' }).withL1L2Config().create()
    const [cache2] = new CacheFactory().merge({ grace: '3m' }).withL1L2Config().create()
    const [cache3] = new CacheFactory().merge({ grace: '3m' }).withL1L2Config().create()

    await cache1.set({ key: 'hello', value: 'world' })
    await cache2.get({ key: 'hello' })
    await cache3.get({ key: 'hello' })

    await cache1.expire({ key: 'hello' })

    const r1 = await cache1.get({ key: 'hello', grace: false })
    const r2 = await cache2.get({ key: 'hello', grace: false })
    const r3 = await cache3.get({ key: 'hello', grace: false })

    const r4 = await cache1.get({ key: 'hello' })
    const r5 = await cache2.get({ key: 'hello' })
    const r6 = await cache3.get({ key: 'hello' })

    assert.deepEqual(r1, undefined)
    assert.deepEqual(r2, undefined)
    assert.deepEqual(r3, undefined)

    assert.deepEqual(r4, 'world')
    assert.deepEqual(r5, 'world')
    assert.deepEqual(r6, 'world')
  })

  test('expire should emit an event', async ({ assert }) => {
    const emitter = new EventEmitter()
    const [cache] = new CacheFactory().merge({ grace: '3m', emitter }).withL1L2Config().create()

    const eventPromise = pEvent(emitter, 'cache:expire')

    await cache.expire({ key: 'hello' })

    const event = await eventPromise
    assert.deepEqual(event, { key: 'hello', store: 'primary' })
  })
})
