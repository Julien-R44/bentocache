import { test } from '@japa/runner'
import { sleep } from '@julr/utils/misc'

import { errors } from '../../src/errors.js'
import { CacheFactory } from '../../factories/cache_factory.js'
import { throwingFactory, slowFactory } from '../helpers/index.js'

test.group('Soft Timeout', () => {
  test('return the graced value when soft timeout is reached', async ({ assert }) => {
    const { cache } = new CacheFactory()
      .merge({
        ttl: 100,
        grace: '6h',
        timeout: 200,
      })
      .withL1L2Config()
      .create()

    // we set a graced value in the cache
    await cache.getOrSet({ key: 'key', factory: () => 'graced value' })
    await sleep(200)

    // when we call getOrSet, it will invoke a factory that takes 400ms to complete
    // so it should return the graced value at 200ms
    const now = Date.now()
    const r1 = await cache.getOrSet({
      key: 'key',
      factory: slowFactory(400, 'new factory value'),
      ttl: '2s',
    })

    const elapsed = Date.now() - now

    // now if we wait for the factory to complete ( another 200ms )
    await sleep(210)
    // we should have the updated value
    const r2 = await cache.getOrSet({
      key: 'key',
      factory: throwingFactory('should not be called'),
    })

    assert.equal(r1, 'graced value')
    assert.equal(r2, 'new factory value')
    assert.isBelow(elapsed, 300)
  })

  test('returns graced value in remote store when soft timeout is reached', async ({ assert }) => {
    const { cache, remote, stack } = new CacheFactory()
      .merge({ ttl: 100, grace: '6h', timeout: 200 })
      .withL1L2Config()
      .create()

    await remote.set(
      'key',
      JSON.stringify({
        value: 'graced value',
        logicalExpiration: new Date(Date.now() - 1000).getTime(),
      }),
      stack.defaultOptions,
    )

    const r1 = await cache.getOrSet({ key: 'key', factory: slowFactory(400, 'new factory value') })
    await sleep(210)
    const r2 = await cache.getOrSet({ key: 'key', factory: slowFactory(400, 'new factory value2') })

    assert.deepEqual(r1, 'graced value')
    assert.deepEqual(r2, 'new factory value')
  })

  test('ignore soft timeout if no graced value is set', async ({ assert }) => {
    const { cache } = new CacheFactory()
      .merge({
        ttl: 100,
        grace: '6h',
        timeout: 200,
      })
      .withL1L2Config()
      .create()

    const now = Date.now()
    const r1 = await cache.getOrSet({ key: 'key', factory: slowFactory(400, 'new factory value') })
    const elapsed = Date.now() - now

    assert.equal(r1, 'new factory value')
    assert.isAbove(elapsed, 400)
  })

  test('keep the lock acquired while the background factory is running', async ({ assert }) => {
    const { cache } = new CacheFactory()
      .merge({
        ttl: 100,
        grace: '6h',
        timeout: 200,
      })
      .withL1L2Config()
      .create()

    await cache.set({ key: 'key', value: 'graced value' })
    await sleep(150)

    let factoryCall = 0
    const factory = async () => {
      await sleep(900)
      factoryCall++
      return 'new factory value'
    }

    // Two concurrents requests
    const r1 = Promise.all([
      cache.getOrSet({ key: 'key', factory }),
      cache.getOrSet({ key: 'key', factory }),
    ])

    // wait for the first soft timeout window to pass
    await sleep(210)

    const r2 = Promise.all([
      cache.getOrSet({ key: 'key', factory }),
      cache.getOrSet({ key: 'key', factory }),
    ])

    await sleep(3000)

    assert.deepEqual(await r1, ['graced value', 'graced value'])
    assert.deepEqual(await r2, ['graced value', 'graced value'])

    const r3 = await cache.get({ key: 'key' })
    assert.equal(r3, 'new factory value')

    assert.equal(factoryCall, 1)
  }).disableTimeout()

  test('background factory should save in local and remote', async ({ assert }) => {
    const { cache, local, remote, stack } = new CacheFactory()
      .merge({ ttl: 100, grace: '6h', timeout: '200ms' })
      .withL1L2Config()
      .create()

    await cache.set({ key: 'key', value: 'graced value' })
    await sleep(150)

    const r1 = await cache.getOrSet({ key: 'key', factory: slowFactory(400, 'new factory value') })

    await sleep(210)

    const r2 = await local.get('key', stack.defaultOptions)
    const r3 = await remote.get('key', stack.defaultOptions)

    assert.deepEqual(r1, 'graced value')
    assert.deepEqual(r2?.getValue(), 'new factory value')
    assert.deepEqual(r3?.getValue(), 'new factory value')
  })

  test('background factory should not generate an unhandled promise rejection', async ({
    assert,
  }) => {
    const { cache } = new CacheFactory()
      .merge({
        ttl: 100,
        grace: '6h',
        timeout: 200,
      })
      .withL1L2Config()
      .create()

    process.on('unhandledRejection', () => assert.fail())

    await cache.set({ key: 'key', value: 'graced value' })
    await sleep(150)

    const r1 = await cache.getOrSet({
      key: 'key',
      factory: async () => {
        await sleep(300)
        throw new Error('factory error')
      },
    })

    await sleep(210)

    const r2 = await cache.get({ key: 'key' })
    assert.equal(r2, 'graced value')
    assert.equal(r1, 'graced value')

    process.removeAllListeners('unhandledRejection')
  })

  test('background factory still release the lock if it fails', async ({ assert }) => {
    const { cache } = new CacheFactory()
      .merge({
        ttl: 100,
        grace: '6h',
        timeout: 200,
      })
      .withL1L2Config()
      .create()

    await cache.set({ key: 'key', value: 'graced value' })
    await sleep(150)

    const r1 = await cache.getOrSet({
      key: 'key',
      factory: async () => {
        await sleep(300)
        throw new Error('factory error')
      },
    })

    await sleep(400)
    const r2 = await cache.getOrSet({ key: 'key', factory: () => 'new factory value' })

    assert.equal(r1, 'graced value')
    assert.equal(r2, 'new factory value')
  })
})

test.group('Hard timeout', () => {
  test('throw a FactoryHardTimeout when hard timeout is reached', async ({ assert }) => {
    const { cache } = new CacheFactory()
      .merge({
        ttl: 100,
        grace: '6h',
        hardTimeout: 200,
      })
      .withL1L2Config()
      .create()

    const now = Date.now()
    const r1 = cache.getOrSet({ key: 'key', factory: slowFactory(400, 'new factory value') })
    await assert.rejects(async () => r1, errors.E_FACTORY_HARD_TIMEOUT.message)

    const elapsed = Date.now() - now
    assert.isBelow(elapsed, 300)
  })

  test('throw a FactoryHardTimeout but continue to execute the factory', async ({ assert }) => {
    const { cache } = new CacheFactory()
      .merge({
        ttl: 100,
        grace: '6h',
        hardTimeout: 200,
      })
      .withL1L2Config()
      .create()

    const r1 = cache.getOrSet({ key: 'key', factory: slowFactory(400, 'new factory value') })
    await assert.rejects(async () => r1, errors.E_FACTORY_HARD_TIMEOUT.message)

    await sleep(410)

    const r2 = await cache.get({ key: 'key' })
    assert.equal(r2, 'new factory value')
  })

  test('background factory should save in local and remote', async ({ assert }) => {
    const { cache, local, remote, stack } = new CacheFactory()
      .merge({
        ttl: 100,
        grace: '6h',
        hardTimeout: 200,
      })
      .withL1L2Config()
      .create()

    const r1 = await cache
      .getOrSet({ key: 'key', factory: slowFactory(400, 'new factory value') })
      .catch(() => {})

    await sleep(210)

    const r2 = await local.get('key', stack.defaultOptions)
    const r3 = await remote.get('key', stack.defaultOptions)

    assert.deepEqual(r1, undefined)
    assert.deepEqual(r2?.getValue(), 'new factory value')
    assert.deepEqual(r3?.getValue(), 'new factory value')
  })
})
