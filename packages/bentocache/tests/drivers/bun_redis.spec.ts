import { test } from '@japa/runner'

import { REDIS_CREDENTIALS } from '../helpers/index.js'
import { registerCacheDriverTestSuite } from '../helpers/driver_test_suite.js'

if (typeof (globalThis as any).Bun !== 'undefined') {
  const { BunRedisDriver } = await import('../../src/drivers/bun_redis.js')

  test.group('Bun Redis driver', (group) => {
    registerCacheDriverTestSuite({
      test,
      group,
      createDriver: (options) =>
        new BunRedisDriver({
          prefix: 'japa',
          connection: `redis://${REDIS_CREDENTIALS.host}:${REDIS_CREDENTIALS.port}`,
          ...options,
        }),
    })

    test('should accept an existing Bun.RedisClient instance', async ({ assert, cleanup }) => {
      const { RedisClient } = await import('bun')
      const client = new RedisClient(`redis://${REDIS_CREDENTIALS.host}:${REDIS_CREDENTIALS.port}`)
      const driver = new BunRedisDriver({ connection: client })

      cleanup(async () => {
        await driver.disconnect()
        client.close()
      })

      assert.equal(driver.getConnection(), client)
    })
  })
}
