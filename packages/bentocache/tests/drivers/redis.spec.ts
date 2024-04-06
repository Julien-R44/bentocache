import { test } from '@japa/runner'
import { Redis as IoRedis } from 'ioredis'

import { REDIS_CREDENTIALS } from '../helpers/index.js'
import { RedisDriver } from '../../src/drivers/redis.js'
import { registerCacheDriverTestSuite } from '../helpers/driver_test_suite.js'

test.group('Redis driver', (group) => {
  registerCacheDriverTestSuite({
    test,
    group,
    createDriver: (options) =>
      new RedisDriver({ prefix: 'japa', connection: REDIS_CREDENTIALS, ...options }),
  })

  test('should be able to provide an instance of ioredis', async ({ assert }) => {
    const ioredis = new IoRedis(REDIS_CREDENTIALS)
    const redis2 = new RedisDriver({ connection: ioredis })

    assert.equal(redis2.getConnection(), ioredis)

    await redis2.disconnect()
    await ioredis.quit()
  })
})
