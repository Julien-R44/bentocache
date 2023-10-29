import { test } from '@japa/runner'
import { Redis as IoRedis } from 'ioredis'

import { Redis } from '../../src/drivers/redis.js'
import { REDIS_CREDENTIALS } from '../../test_helpers/index.js'
import { registerApiTestSuite } from '../../test_helpers/driver_test_suite.js'

registerApiTestSuite({
  name: 'Redis',
  test,
  driver: Redis,
  config: {
    prefix: 'japa',
    connection: REDIS_CREDENTIALS,
  },
})

test.group('Redis driver', (group) => {
  let redis: Redis

  group.each.setup(async () => {
    redis = new Redis({ connection: REDIS_CREDENTIALS, prefix: 'japa' })

    return async () => {
      await redis.clear()
      await redis.disconnect()
    }
  })

  test('should be able to provide an instance of ioredis', async ({ assert }) => {
    const ioredis = new IoRedis(REDIS_CREDENTIALS)
    const redis2 = new Redis({ connection: ioredis })

    assert.equal(redis2.getConnection(), ioredis)

    await redis2.disconnect()
  })
})
