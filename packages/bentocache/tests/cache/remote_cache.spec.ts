import { test } from '@japa/runner'
import { testLogger } from '@julr/utils/logger'

import { REDIS_CREDENTIALS } from '../helpers/index.js'
import { RedisDriver } from '../../src/drivers/redis.js'
import { ChaosCache } from '../helpers/chaos/chaos_cache.js'
import { JsonSerializer } from '../../src/serializers/json.js'
import { RemoteCache } from '../../src/cache/facades/remote_cache.js'
import { createCacheEntryOptions } from '../../src/cache/cache_entry/cache_entry_options.js'

test.group('Remote Cache', () => {
  test('should rethrows errors if suppressL2Errors is disabled', async ({ assert, cleanup }) => {
    const logger = testLogger()
    const chaosCacheDriver = new ChaosCache(new RedisDriver({ connection: REDIS_CREDENTIALS }))
    const cache = new RemoteCache(chaosCacheDriver, logger, new JsonSerializer(), true)

    cleanup(() => chaosCacheDriver.disconnect())

    chaosCacheDriver.alwaysThrow()

    const options = createCacheEntryOptions({ suppressL2Errors: false })

    await assert.rejects(() => cache.get('foo', options))
    await assert.rejects(() => cache.set('foo', 'bar', options))
    await assert.rejects(() => cache.delete('foo', options))
    await assert.rejects(() => cache.deleteMany(['foo'], options))
    await assert.rejects(() => cache.has('foo', options))

    assert.deepEqual(logger.logs.length, 5)
  })

  test('should ignore errors if suppressL2Errors is enabled', async ({ assert, cleanup }) => {
    const logger = testLogger()
    const chaosCacheDriver = new ChaosCache(new RedisDriver({ connection: REDIS_CREDENTIALS }))
    const cache = new RemoteCache(chaosCacheDriver, logger, new JsonSerializer(), true)

    cleanup(() => chaosCacheDriver.disconnect())

    chaosCacheDriver.alwaysThrow()

    const options = createCacheEntryOptions({ suppressL2Errors: true })

    await assert.doesNotReject(() => cache.get('foo', options))
    await assert.doesNotReject(() => cache.set('foo', 'bar', options))
    await assert.doesNotReject(() => cache.delete('foo', options))
    await assert.doesNotReject(() => cache.deleteMany(['foo'], options))
    await assert.doesNotReject(() => cache.has('foo', options))

    assert.deepEqual(logger.logs.length, 5)
  })

  test('rethrow errors if suppressL2Errors is not explicity set and we have not l1', async ({
    assert,
    cleanup,
  }) => {
    const logger = testLogger()
    const chaosCacheDriver = new ChaosCache(new RedisDriver({ connection: REDIS_CREDENTIALS }))
    const cache = new RemoteCache(chaosCacheDriver, logger, new JsonSerializer(), false)

    cleanup(() => chaosCacheDriver.disconnect())

    chaosCacheDriver.alwaysThrow()

    const options = createCacheEntryOptions({})

    await assert.rejects(() => cache.get('foo', options))
    await assert.rejects(() => cache.set('foo', 'bar', options))
    await assert.rejects(() => cache.delete('foo', options))
    await assert.rejects(() => cache.deleteMany(['foo'], options))
    await assert.rejects(() => cache.has('foo', options))

    assert.deepEqual(logger.logs.length, 5)
  })

  test('suppress errors if suppressL2Errors is explicitly set to true and we have not l1', async ({
    assert,
    cleanup,
  }) => {
    const logger = testLogger()
    const chaosCacheDriver = new ChaosCache(new RedisDriver({ connection: REDIS_CREDENTIALS }))
    const cache = new RemoteCache(chaosCacheDriver, logger, new JsonSerializer(), false)

    cleanup(() => chaosCacheDriver.disconnect())

    chaosCacheDriver.alwaysThrow()

    const options = createCacheEntryOptions({ suppressL2Errors: true })

    await assert.doesNotReject(() => cache.get('foo', options))
    await assert.doesNotReject(() => cache.set('foo', 'bar', options))
    await assert.doesNotReject(() => cache.delete('foo', options))
    await assert.doesNotReject(() => cache.deleteMany(['foo'], options))
    await assert.doesNotReject(() => cache.has('foo', options))

    assert.deepEqual(logger.logs.length, 5)
  })
})
