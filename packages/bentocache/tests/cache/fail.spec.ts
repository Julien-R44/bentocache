import { test } from '@japa/runner'
import { sleep } from '@julr/utils/misc'

import { sequentialFactory } from '../helpers/index.js'
import { CacheFactory } from '../../factories/cache_factory.js'

test.group('Fail', () => {
  test('should use graced value', async ({ assert }) => {
    const { cache } = new CacheFactory()
      .merge({ grace: '2m', timeout: '2s' })
      .withL1L2Config()
      .create()

    const factory = sequentialFactory([() => 'foo', ({ fail }) => fail('error')])

    const r1 = await cache.getOrSet({ ttl: 100, key: 'foo', factory })
    await sleep(100)
    const r2 = await cache.getOrSet({ key: 'foo', factory })

    assert.deepEqual(factory.callsCount(), 2)
    assert.deepEqual(r1, 'foo')
    assert.deepEqual(r2, 'foo')
  })

  test('throw error if no graced value', async ({ assert }) => {
    const { cache } = new CacheFactory().withL1L2Config().create()
    const factory = sequentialFactory([({ fail }) => fail()])

    await assert.rejects(() => cache.getOrSet({ key: 'foo', factory }))
  })
})
