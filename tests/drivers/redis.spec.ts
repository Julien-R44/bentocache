/*
 * @quakjs/bentocache
 *
 * (c) Quak
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { Redis } from '../../src/drivers/redis.js'
import { REDIS_CREDENTIALS } from '../../test_helpers/index.js'
import { registerApiTestSuite } from '../../test_helpers/driver_test_suite.js'

import { test } from '@japa/runner'
import { Redis as IoRedis } from 'ioredis'

registerApiTestSuite({
  name: 'Redis',
  test,
  driver: Redis,
  config: {
    ttl: 30 * 100,
    prefix: 'japa',
    connection: REDIS_CREDENTIALS,
  },
})

test.group('Redis driver', (group) => {
  let redis: Redis

  group.each.setup(async () => {
    redis = new Redis({ connection: REDIS_CREDENTIALS, prefix: 'japa', ttl: 1000 })

    return async () => {
      await redis.clear()
      await redis.disconnect()
    }
  })

  test('should be able to provide an instance of ioredis', async ({ assert }) => {
    const ioredis = new IoRedis(REDIS_CREDENTIALS)
    const redis2 = new Redis({ connection: ioredis, ttl: 1000 })

    assert.equal(redis2.getConnection(), ioredis)

    await redis2.disconnect()
  })
})
