import { test } from '@japa/runner'
import { sleep } from '@julr/utils/misc'

import { sequentialFactory } from '../helpers/index.js'
import { CacheFactory } from '../../factories/cache_factory.js'

test.group('Skip caching', () => {
  test('do not cache if skip is returned', async ({ assert }) => {
    const { cache } = new CacheFactory().withL1L2Config().create()

    const factory = sequentialFactory([({ skip }) => skip(), () => 'bar'])

    const r1 = await cache.getOrSet({ key: 'foo', factory })
    const r2 = await cache.getOrSet({ key: 'foo', factory })

    assert.deepEqual(factory.callsCount(), 2)
    assert.deepEqual(r1, undefined)
    assert.deepEqual(r2, 'bar')
  })

  test('do not use graced value if skip is returned', async ({ assert }) => {
    const { cache } = new CacheFactory()
      .merge({ timeout: '2s', grace: '2m' })
      .withL1L2Config()
      .create()

    const factory = sequentialFactory([() => 'bar', ({ skip }) => skip()])

    const r1 = await cache.getOrSet({ key: 'foo', factory, ttl: 10 })
    await sleep(50)
    const r2 = await cache.getOrSet({ key: 'foo', factory })

    assert.deepEqual(factory.callsCount(), 2)
    assert.deepEqual(r1, 'bar')
    assert.deepEqual(r2, undefined)
  })
})
