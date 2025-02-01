import { test } from '@japa/runner'

import { errors } from '../index.js'
import { CacheFactory } from '../factories/cache_factory.js'

test.group('Factory Runner', () => {
  test('throw a E_FACTORY_ERROR with original error cause', async ({ assert }) => {
    assert.plan(3)

    const { cache } = new CacheFactory().withL1L2Config().create()

    class MyError extends Error {
      constructor() {
        super('My error')
        this.name = 'MyError'
      }
    }

    try {
      await cache.getOrSet({
        key: 'foo',
        factory: () => {
          throw new MyError()
        },
      })
    } catch (error) {
      assert.instanceOf(error, errors.E_FACTORY_ERROR)
      assert.instanceOf(error.cause, MyError)
      assert.deepEqual(error.key, 'foo')
    }
  })
})
