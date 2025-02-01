import { test } from '@japa/runner'
import { setTimeout } from 'node:timers/promises'

import { errors } from '../../src/errors.js'
import { RedisDriver } from '../../src/drivers/redis.js'
import { MemoryDriver } from '../../src/drivers/memory.js'
import { CacheFactory } from '../../factories/cache_factory.js'
import { REDIS_CREDENTIALS, throwingFactory } from '../helpers/index.js'

test.group('Cache | Stampede protection', () => {
  test('only one background factory should be executed if soft timeout is triggered', async ({
    assert,
  }) => {
    const { cache } = new CacheFactory()
      .merge({ grace: '6h', timeout: '100ms' })
      .withL1L2Config()
      .create()

    await cache.set({ key: 'key', value: 'value', ttl: '100ms' })
    await setTimeout(110)

    let factoryCalls = 0
    const factory = async () => {
      factoryCalls++
      await setTimeout(300)
      return 'value'
    }

    const promises = []

    for (let i = 0; i < 100; i++) {
      promises.push(cache.getOrSet({ key: 'key', factory }))
      await setTimeout(1)
    }

    const results = await Promise.all(promises)

    assert.isTrue(results.every((result) => result === 'value'))
    assert.equal(factoryCalls, 1)
  })

  test('multiple concurrent calls should ask remote only once', async ({ assert }) => {
    class RemoteDriver extends MemoryDriver {
      askedKeys: string[] = []

      get(key: string) {
        this.askedKeys.push(key)
        return super.get(key)
      }
    }

    const remoteDriver = new RemoteDriver({})
    const { cache } = new CacheFactory()
      .merge({ l2Driver: remoteDriver as any })
      .withL1L2Config()
      .create()

    const results = await Promise.all([
      cache.getOrSet({ key: 'key', factory: async () => 42 }),
      cache.getOrSet({ key: 'key', factory: async () => 42 }),
      cache.getOrSet({ key: 'key', factory: async () => 42 }),
      cache.getOrSet({ key: 'key', factory: async () => 42 }),
      cache.getOrSet({ key: 'key', factory: async () => 42 }),
    ])

    assert.deepEqual(results, [42, 42, 42, 42, 42])
    assert.deepEqual(remoteDriver.askedKeys, ['key'])
  })

  test('getOrSet() factory should be called only once', async ({ assert }) => {
    const { cache } = new CacheFactory().withL1L2Config().create()
    let factoryCalls = 0

    const factory = async () => {
      await setTimeout(100)
      factoryCalls++
      return 'value'
    }

    const results = await Promise.all([
      cache.getOrSet({ key: 'key', factory }),
      cache.getOrSet({ key: 'key', factory }),
    ])

    assert.deepEqual(results, ['value', 'value'])
    assert.equal(factoryCalls, 1)
  })

  test('getOrSetForever() factory should be called only once', async ({ assert }) => {
    const { cache } = new CacheFactory().withL1L2Config().create()
    let factoryCalls = 0

    const factory = async () => {
      await setTimeout(100)
      factoryCalls++
      return 'value'
    }

    const results = await Promise.all([
      cache.getOrSetForever({ key: 'key', factory }),
      cache.getOrSetForever({ key: 'key', factory }),
    ])

    assert.deepEqual(results, ['value', 'value'])
    assert.equal(factoryCalls, 1)
  })

  test('if factory throws an error it should release the lock', async ({ assert }) => {
    const { cache } = new CacheFactory().withL1L2Config().create()

    const results = await Promise.allSettled([
      cache.getOrSet({ key: 'key', factory: throwingFactory('foo') }),
      cache.getOrSet({
        key: 'key',
        factory: async () => {
          await setTimeout(100)
          return 'value'
        },
      }),
    ])

    assert.deepEqual(results[0].status, 'rejected')
    // @ts-ignore
    assert.instanceOf(results[0].reason, errors.E_FACTORY_ERROR)

    assert.deepEqual(results[1].status, 'fulfilled')
    // @ts-ignore
    assert.deepEqual(results[1].value, 'value')
  })

  test('high concurrency but only one factory call')
    .with([100, 1000, 10_000])
    .run(async ({ assert }, concurrency) => {
      const { cache } = new CacheFactory().withL1L2Config().create()
      let factoryCalls = 0

      const factory = async () => {
        await setTimeout(300)
        factoryCalls++
        return 'value'
      }

      const results = await Promise.all(
        Array.from({ length: concurrency }).map(() => cache.getOrSet({ key: 'key', factory })),
      )

      assert.deepEqual(results, Array.from({ length: concurrency }).fill('value'))
      assert.equal(factoryCalls, 1)
    })

  test('high concurrency but only one factory call - one tier local')
    .with([100, 1000, 10_000])
    .run(async ({ assert }, concurrency) => {
      const { cache } = new CacheFactory()
        .merge({ l1Driver: new MemoryDriver({ maxSize: 100, prefix: 'test' }) })
        .create()

      let factoryCalls = 0

      const factory = async () => {
        await setTimeout(300)
        factoryCalls++
        return 'value'
      }

      const results = await Promise.all(
        Array.from({ length: concurrency }).map(() => cache.getOrSet({ key: 'key', factory })),
      )

      assert.deepEqual(results, Array.from({ length: concurrency }).fill('value'))
      assert.equal(factoryCalls, 1)
    })

  test('high concurrency but only one factory call - one tier remote')
    .with([100, 1000, 10_000])
    .disableTimeout()
    .run(async ({ assert }, concurrency) => {
      const { cache } = new CacheFactory()
        .merge({ l2Driver: new RedisDriver({ connection: REDIS_CREDENTIALS }) })
        .create()

      let factoryCalls = 0

      const factory = async () => {
        await setTimeout(300)
        factoryCalls++
        return 'value'
      }

      const results = await Promise.all(
        Array.from({ length: concurrency }).map(() => cache.getOrSet({ key: 'key', factory })),
      )

      assert.deepEqual(results, Array.from({ length: concurrency }).fill('value'))
      assert.equal(factoryCalls, 1)
    })
})
