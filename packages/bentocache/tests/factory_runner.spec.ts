import { test } from '@japa/runner'
import { sleep } from '@julr/utils/misc'

import { errors } from '../index.js'
import { CacheFactory } from '../factories/cache_factory.js'

class MyError extends Error {
  constructor() {
    super('My error')
    this.name = 'MyError'
  }
}

test.group('Factory Runner', () => {
  test('throw a E_FACTORY_ERROR with original error cause', async ({ assert }) => {
    assert.plan(3)

    const { cache } = new CacheFactory().withL1L2Config().create()

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

  test('throws a E_FACTORY_ERROR on background factory', async ({ assert }) => {
    const { cache } = new CacheFactory().withL1L2Config().create()

    await cache.set({ key: 'foo', value: 'bar', ttl: 100, grace: '5s' })
    await sleep(200)

    const result = await cache.getOrSet({
      key: 'foo',
      grace: '5s',
      factory: () => {
        throw new MyError()
      },
      onFactoryError: (error) => {
        assert.instanceOf(error, errors.E_FACTORY_ERROR)
        assert.instanceOf(error.cause, MyError)
        assert.isTrue(error.isBackgroundFactory)
      },
    })

    assert.deepEqual(result, 'bar')
  })
})
