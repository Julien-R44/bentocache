import { test } from '@japa/runner'
import { sleep } from '@julr/utils/misc'

import { CacheFactory } from '../../factories/cache_factory.js'

test.group('SWR with background revalidation', () => {
  test('should return stale immediately when factory is running in background', async ({
    assert,
  }) => {
    const { cache } = new CacheFactory()
      .merge({
        ttl: 100,
        grace: '6h',
        timeout: 0,
      })
      .withL1L2Config()
      .create()

    await cache.set({ key: 'key', value: 'stale value' })
    await sleep(150)

    let factoryCallCount = 0
    const slowFactory = async () => {
      factoryCallCount++
      await sleep(1000)
      return `fresh value ${factoryCallCount}`
    }

    const start1 = Date.now()
    const result1 = await cache.getOrSet({ key: 'key', factory: slowFactory })
    const elapsed1 = Date.now() - start1

    await sleep(100)

    const start2 = Date.now()
    const result2 = await cache.getOrSet({ key: 'key', factory: slowFactory })
    const elapsed2 = Date.now() - start2

    assert.equal(result1, 'stale value')
    assert.equal(result2, 'stale value')
    assert.isBelow(elapsed1, 100)
    assert.isBelow(elapsed2, 100)
    assert.equal(factoryCallCount, 1)

    await sleep(1100)

    const result3 = await cache.get({ key: 'key' })
    assert.equal(result3, 'fresh value 1')
  })

  test('lockTimeout should not prevent immediate return when timeout is 0', async ({ assert }) => {
    const { cache } = new CacheFactory()
      .merge({
        ttl: 100,
        grace: '6h',
        timeout: 0,
        lockTimeout: 5000,
      })
      .withL1L2Config()
      .create()

    await cache.set({ key: 'key', value: 'stale value' })
    await sleep(150)

    let factoryCallCount = 0

    const start1 = Date.now()
    const promise1 = cache.getOrSet({
      key: 'key',
      factory: async () => {
        factoryCallCount++
        await sleep(2000)
        return `factory-call-${factoryCallCount}`
      },
    })
    const result1 = await promise1
    const elapsed1 = Date.now() - start1

    const start2 = Date.now()
    const result2 = await cache.getOrSet({
      key: 'key',
      factory: async () => {
        factoryCallCount++
        return `factory-call-${factoryCallCount}`
      },
    })
    const elapsed2 = Date.now() - start2

    assert.equal(result1, 'stale value')
    assert.equal(result2, 'stale value')
    assert.isBelow(elapsed1, 100)
    assert.isBelow(elapsed2, 100)
    assert.equal(factoryCallCount, 1)
  }).timeout(10_000)
})
