import { test } from '@japa/runner'
import { Redis as IoRedis } from 'ioredis'

import { Redis } from '../../src/drivers/redis.js'
import { REDIS_CREDENTIALS } from '../../test_helpers/index.js'
import { registerCacheDriverTestSuite } from '../../test_helpers/driver_test_suite.js'

test.group('Redis driver', (group) => {
  registerCacheDriverTestSuite({
    test,
    group,
    createDriver: (options) =>
      new Redis({ prefix: 'japa', connection: REDIS_CREDENTIALS, ...options }),
  })

  test('should be able to provide an instance of ioredis', async ({ assert }) => {
    const ioredis = new IoRedis(REDIS_CREDENTIALS)
    const redis2 = new Redis({ connection: ioredis })

    assert.equal(redis2.getConnection(), ioredis)

    await redis2.disconnect()
    await ioredis.quit()
  })
})
