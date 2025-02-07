import { test } from '@japa/runner'
import { sleep } from '@julr/utils/misc'

import { throwingFactory } from '../helpers/index.js'
import type { FactoryError } from '../../src/errors.js'
import { CacheFactory } from '../../factories/cache_factory.js'

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
})
