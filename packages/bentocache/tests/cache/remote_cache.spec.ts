import { test } from '@japa/runner'

import { TestLogger } from '../helpers/test_logger.js'
import { REDIS_CREDENTIALS } from '../helpers/index.js'
import { RedisDriver } from '../../src/drivers/redis.js'
import { ChaosCache } from '../helpers/chaos/chaos_cache.js'
import { JsonSerializer } from '../../src/serializers/json.js'
import { RemoteCache } from '../../src/cache/facades/remote_cache.js'
import { CacheEntryOptions } from '../../src/cache/cache_entry/cache_entry_options.js'

test.group('Remote Cache', () => {
  test('should rethrows errors if suppressL2Errors is disabled', async ({ assert, cleanup }) => {
    const logger = new TestLogger()
    const chaosCacheDriver = new ChaosCache(new RedisDriver({ connection: REDIS_CREDENTIALS }))
    const cache = new RemoteCache(chaosCacheDriver, logger, new JsonSerializer())

    cleanup(() => chaosCacheDriver.disconnect())

    chaosCacheDriver.alwaysThrow()

    const options = new CacheEntryOptions({ suppressL2Errors: false })

    await assert.rejects(() => cache.get('foo', options))
    await assert.rejects(() => cache.set('foo', 'bar', options))
    await assert.rejects(() => cache.delete('foo', options))
    await assert.rejects(() => cache.deleteMany(['foo'], options))
    await assert.rejects(() => cache.has('foo', options))

    assert.deepEqual(logger.logs.length, 5)
  })

  test('should ignore errors if suppressL2Errors is enabled', async ({ assert, cleanup }) => {
    const logger = new TestLogger()
    const chaosCacheDriver = new ChaosCache(new RedisDriver({ connection: REDIS_CREDENTIALS }))
    const cache = new RemoteCache(chaosCacheDriver, logger, new JsonSerializer())

    cleanup(() => chaosCacheDriver.disconnect())

    chaosCacheDriver.alwaysThrow()

    const options = new CacheEntryOptions({ suppressL2Errors: true })

    await assert.doesNotRejects(() => cache.get('foo', options))
    await assert.doesNotRejects(() => cache.set('foo', 'bar', options))
    await assert.doesNotRejects(() => cache.delete('foo', options))
    await assert.doesNotRejects(() => cache.deleteMany(['foo'], options))
    await assert.doesNotRejects(() => cache.has('foo', options))

    assert.deepEqual(logger.logs.length, 5)
  })
})
