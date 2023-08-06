import { test } from '@japa/runner'
import { setTimeout } from 'node:timers/promises'

import { CacheFactory } from '../../factories/cache_factory.js'
import { throwingFactory } from '../../test_helpers/index.js'

test.group('Cache | Stampede protection', () => {
  test('getOrSet should have cache stampede protection', async ({ assert }) => {
    assert.plan(2)

    const { cache } = new CacheFactory().create()

    const factory = async () => {
      await setTimeout(100)
      assert.incrementAssertionsCount()
      return 'value'
    }

    const results = await Promise.all([
      cache.getOrSet('key', factory),
      cache.getOrSet('key', factory),
    ])

    assert.deepEqual(results, ['value', 'value'])
  })

  test('getOrSetForever should have cache stampede protection', async ({ assert }) => {
    assert.plan(2)

    const { cache } = new CacheFactory().create()

    const factory = async () => {
      await setTimeout(100)
      assert.incrementAssertionsCount()
      return 'value'
    }

    const results = await Promise.all([
      cache.getOrSetForever('key', factory),
      cache.getOrSetForever('key', factory),
    ])

    assert.deepEqual(results, ['value', 'value'])
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
})
