import { test } from '@japa/runner'
import { setTimeout } from 'node:timers/promises'

import { E_FACTORY_HARD_TIMEOUT } from '../../src/errors.js'
import { CacheFactory } from '../../factories/cache_factory.js'
import { throwingFactory, slowFactory } from '../../test_helpers/index.js'

test.group('Soft Timeout', () => {
  test('should return the graced value when soft timeout is reached', async ({ assert }) => {
    const { cache } = new CacheFactory()
      .merge({
        ttl: 100,
        gracePeriod: { enabled: true, duration: '6h' },
        timeouts: { soft: 200 },
      })
      .create()

    // we set a graced value in the cache
    await cache.getOrSet('key', () => 'graced value')
    await setTimeout(200)

    // when we call getOrSet, it will invoke a factory that takes 400ms to complete
    // so it should return the graced value at 200ms
    const now = Date.now()
    const r1 = await cache.getOrSet('key', slowFactory(400, 'new factory value'), {
      ttl: '2s',
    })
    const elapsed = Date.now() - now

    // now if we wait for the factory to complete ( another 200ms )
    await setTimeout(210)
    // we should have the updated value
    const r2 = await cache.getOrSet('key', throwingFactory('should not be called'))

    assert.equal(r1, 'graced value')
    assert.equal(r2, 'new factory value')
    assert.isBelow(elapsed, 300)
  })

  test('should returns graced value in remote store when soft timeout is reached', async ({
    assert,
  }) => {
    const { cache, remote, stack } = new CacheFactory()
      .merge({ ttl: 100, gracePeriod: { enabled: true, duration: '6h' }, timeouts: { soft: 200 } })
      .create()

    await remote.set(
      'key',
      JSON.stringify({
        value: 'graced value',
        logicalExpiration: new Date(Date.now() - 1000).getTime(),
      }),
      stack.defaultOptions,
    )

    const r1 = await cache.getOrSet('key', slowFactory(400, 'new factory value'))
    await setTimeout(210)
    const r2 = await cache.getOrSet('key', slowFactory(400, 'new factory value2'))

    assert.deepEqual(r1, 'graced value')
    assert.deepEqual(r2, 'new factory value')
  })

  test('should ignore soft timeout if no graced value is set', async ({ assert }) => {
    const { cache } = new CacheFactory()
      .merge({
        ttl: 100,
        gracePeriod: { enabled: true, duration: '6h' },
        timeouts: { soft: 200 },
      })
      .create()

    const now = Date.now()
    const r1 = await cache.getOrSet('key', slowFactory(400, 'new factory value'))
    const elapsed = Date.now() - now

    assert.equal(r1, 'new factory value')
    assert.isAbove(elapsed, 400)
  })

  test('should keep the lock acquired while the factory is running', async ({ assert }) => {
    const { cache } = new CacheFactory()
      .merge({
        ttl: 100,
        gracePeriod: { enabled: true, duration: '6h', fallbackDuration: null },
        timeouts: { soft: 200 },
      })
      .create()

    await cache.set('key', 'graced value')
    await setTimeout(150)

    let factoryCall = 0
    const factory = async () => {
      await setTimeout(900)
      factoryCall++
      return 'new factory value'
    }

    // Two concurrents requests
    const r1 = Promise.all([cache.getOrSet('key', factory), cache.getOrSet('key', factory)])

    // wait for the first soft timeout window to pass
    await setTimeout(210)

    const r2 = Promise.all([cache.getOrSet('key', factory), cache.getOrSet('key', factory)])

    await setTimeout(3000)

    assert.deepEqual(await r1, ['graced value', 'graced value'])
    assert.deepEqual(await r2, ['graced value', 'graced value'])

    const r3 = await cache.get('key')
    assert.equal(r3, 'new factory value')

    assert.equal(factoryCall, 1)
  }).disableTimeout()

  test('background factory should save in local and remote', async ({ assert }) => {
    const { cache, local, remote, stack } = new CacheFactory()
      .merge({
        ttl: 100,
        gracePeriod: { enabled: true, duration: '6h' },
        timeouts: { soft: 200 },
      })
      .create()

    await cache.set('key', 'graced value')
    await setTimeout(150)

    const r1 = await cache.getOrSet('key', slowFactory(400, 'new factory value'))

    await setTimeout(210)

    const r2 = await local.get('key', stack.defaultOptions)
    const r3 = await remote.get('key', stack.defaultOptions)

    assert.deepEqual(r1, 'graced value')
    assert.deepEqual(r2?.getValue(), 'new factory value')
    assert.deepEqual(r3?.getValue(), 'new factory value')
  })
})

test.group('Hard timeout', () => {
  test('should throw a FactoryHardTimeout when hard timeout is reached', async ({ assert }) => {
    const { cache } = new CacheFactory()
      .merge({
        ttl: 100,
        gracePeriod: { enabled: true, duration: '6h' },
        timeouts: { hard: 200 },
      })
      .create()

    const now = Date.now()
    const r1 = cache.getOrSet('key', slowFactory(400, 'new factory value'))
    await assert.rejects(async () => r1, new E_FACTORY_HARD_TIMEOUT().message)

    const elapsed = Date.now() - now
    assert.isBelow(elapsed, 300)
  })

  test('should throw a FactoryHardTimeout but continue to execute the factory', async ({
    assert,
  }) => {
    const { cache } = new CacheFactory()
      .merge({
        ttl: 100,
        gracePeriod: { enabled: true, duration: '6h' },
        timeouts: { hard: 200 },
      })
      .create()

    const r1 = cache.getOrSet('key', slowFactory(400, 'new factory value'))
    await assert.rejects(async () => r1, new E_FACTORY_HARD_TIMEOUT().message)

    await setTimeout(410)

    const r2 = await cache.get('key')
    assert.equal(r2, 'new factory value')
  })

  test('background factory should save in local and remote', async ({ assert }) => {
    const { cache, local, remote, stack } = new CacheFactory()
      .merge({
        ttl: 100,
        gracePeriod: { enabled: true, duration: '6h' },
        timeouts: { hard: 200 },
      })
      .create()

    await cache.set('key', 'graced value')
    await setTimeout(150)

    const r1 = await cache.getOrSet('key', slowFactory(400, 'new factory value'))

    await setTimeout(210)

    const r2 = await local.get('key', stack.defaultOptions)
    const r3 = await remote.get('key', stack.defaultOptions)

    assert.deepEqual(r1, 'graced value')
    assert.deepEqual(r2?.getValue(), 'new factory value')
    assert.deepEqual(r3?.getValue(), 'new factory value')
  })
})
