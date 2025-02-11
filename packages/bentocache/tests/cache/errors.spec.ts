import { test } from '@japa/runner'
import { sleep } from '@julr/utils/misc'

import { RedisDriver } from '../../src/drivers/redis.js'
import { ChaosCache } from '../helpers/chaos/chaos_cache.js'
import { CacheFactory } from '../../factories/cache_factory.js'
import { L2CacheError, type FactoryError } from '../../src/errors.js'
import { REDIS_CREDENTIALS, throwingFactory } from '../helpers/index.js'

test.group('Error handling', () => {
  test('handle foreground factory error', async ({ assert }) => {
    assert.plan(3)

    const { cache } = new CacheFactory()
      .withL1L2Config()
      .merge({
        onFactoryError: (error: FactoryError) => {
          if (error.cause instanceof Error) {
            assert.deepEqual(error.key, 'error')
            assert.deepEqual(error.cause?.message, 'Factory error')
            assert.deepEqual(error.isBackgroundFactory, false)
          }
        },
      })
      .create()

    await cache
      .getOrSet({ key: 'error', factory: throwingFactory('Factory error') })
      .catch(() => {})
  })

  test('handle background factory error', async ({ assert }) => {
    assert.plan(3)

    const { cache } = new CacheFactory()
      .withL1L2Config()
      .merge({
        grace: '10m',
        onFactoryError: (error: FactoryError) => {
          if (error.cause instanceof Error) {
            assert.deepEqual(error.key, 'error')
            assert.deepEqual(error.cause?.message, 'Factory error')
            assert.deepEqual(error.isBackgroundFactory, true)
          }
        },
      })
      .create()

    await cache.set({ key: 'error', value: 'value', ttl: 10 })

    await sleep(50)

    await cache
      .getOrSet({ key: 'error', factory: throwingFactory('Factory error') })
      .catch(() => {})
  })

  test('should throw E_L2_CACHE_ERROR if l2 fails', async ({ cleanup }) => {
    const l2 = new ChaosCache(new RedisDriver({ connection: REDIS_CREDENTIALS }))
    cleanup(() => l2.disconnect())

    const { cache } = new CacheFactory()
      .withMemoryL1()
      .merge({ l2Driver: l2, suppressL2Errors: false })
      .create()

    await cache.getOrSet({
      key: 'foo',
      factory: () => {
        l2.alwaysThrow()
        return 'bar'
      },
    })
  }).throws(L2CacheError.message, L2CacheError)
})
