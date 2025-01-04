import superjson from 'superjson'
import { test } from '@japa/runner'

import { CacheFactory } from '../factories/cache_factory.js'

test.group('serialization', () => {
  test('should be able to provide custom serializer', async ({ assert }) => {
    const { cache } = new CacheFactory()
      .withL1L2Config()
      .merge({
        serializer: {
          serialize(value) {
            return superjson.stringify(value)
          },
          deserialize(value) {
            return superjson.parse(value)
          },
        },
      })
      .create()

    await cache.set({
      key: 'key',
      value: { name: 'Jul', date: new Date() },
      ttl: '10m',
    })

    const result = await cache.get('key')
    assert.instanceOf(result.date, Date)
  })
})
