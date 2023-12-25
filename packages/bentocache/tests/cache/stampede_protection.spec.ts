import { test } from '@japa/runner'
import { setTimeout } from 'node:timers/promises'

import { Memory } from '../../src/drivers/memory.js'
import { throwingFactory } from '../../test_helpers/index.js'
import { CacheFactory } from '../../factories/cache_factory.js'

test.group('Cache | Stampede protection', () => {
  test('only one background factory should be executed if soft timeout is triggered', async ({
    assert,
  }) => {
    const { cache } = new CacheFactory()
      .merge({ gracePeriod: { enabled: true, duration: '6h' }, timeouts: { soft: '100ms' } })
      .create()

    await cache.set('key', 'value', { ttl: '100ms' })
    await setTimeout(110)

    let factoryCalls = 0
    const factory = async () => {
      factoryCalls++
      await setTimeout(300)
      return 'value'
    }

    const promises = []

    for (let i = 0; i < 100; i++) {
      promises.push(cache.getOrSet('key', factory))
      await setTimeout(1)
    }

    const results = await Promise.all(promises)

    assert.isTrue(results.every((result) => result === 'value'))
    assert.equal(factoryCalls, 1)
  })

  test('multiple concurrent calls should ask remote only once', async ({ assert }) => {
    class RemoteDriver extends Memory {
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
      cache.getOrSet('key', async () => 42),
      cache.getOrSet('key', async () => 42),
      cache.getOrSet('key', async () => 42),
      cache.getOrSet('key', async () => 42),
      cache.getOrSet('key', async () => 42),
    ])

    assert.deepEqual(results, [42, 42, 42, 42, 42])
    assert.deepEqual(remoteDriver.askedKeys, ['key'])
  })

  test('getOrSet() factory should be called only once', async ({ assert }) => {
    const { cache } = new CacheFactory().create()
    let factoryCalls = 0

    const factory = async () => {
      await setTimeout(100)
      factoryCalls++
      return 'value'
    }

    const results = await Promise.all([
      cache.getOrSet('key', factory),
      cache.getOrSet('key', factory),
    ])

    assert.deepEqual(results, ['value', 'value'])
    assert.equal(factoryCalls, 1)
  })

  test('getOrSetForever() factory should be called only once', async ({ assert }) => {
    const { cache } = new CacheFactory().create()
    let factoryCalls = 0

    const factory = async () => {
      await setTimeout(100)
      factoryCalls++
      return 'value'
    }

    const results = await Promise.all([
      cache.getOrSetForever('key', factory),
      cache.getOrSetForever('key', factory),
    ])

    assert.deepEqual(results, ['value', 'value'])
    assert.equal(factoryCalls, 1)
  })

  test('if factory throws an error it should release the lock', async ({ assert }) => {
    const { cache } = new CacheFactory().create()

    const results = await Promise.allSettled([
      cache.getOrSet('key', throwingFactory('foo')),
      cache.getOrSet('key', async () => {
        await setTimeout(100)
        return 'value'
      }),
    ])

    assert.deepEqual(results, [
      { status: 'rejected', reason: new Error('foo') },
      { status: 'fulfilled', value: 'value' },
    ])
  })

  test('high concurrency but only one factory call')
    .with([100, 1000, 10_000])
    .run(async ({ assert }, concurrency) => {
      const { cache } = new CacheFactory().create()
      let factoryCalls = 0

      const factory = async () => {
        await setTimeout(300)
        factoryCalls++
        return 'value'
      }

      const results = await Promise.all(
        Array.from({ length: concurrency }).map(() => cache.getOrSet('key', factory)),
      )

      assert.deepEqual(results, Array.from({ length: concurrency }).fill('value'))
      assert.equal(factoryCalls, 1)
    })
})
