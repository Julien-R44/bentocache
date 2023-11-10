import { test } from '@japa/runner'

import { Memory } from '../../src/drivers/memory.js'
import { TestLogger } from '../../test_helpers/test_logger.js'
import { ChaosCache } from '../../test_helpers/chaos/chaos_cache.js'
import { RemoteCache } from '../../src/cache/facades/remote_cache.js'
import { CacheEntryOptions } from '../../src/cache/cache_entry/cache_entry_options.js'

test.group('Remote Cache', () => {
  test('should rethrows errors if suppressL2Errors is disabled', async ({ assert }) => {
    const logger = new TestLogger()
    const chaosCacheDriver = new ChaosCache(new Memory())
    const cache = new RemoteCache(chaosCacheDriver, logger)

    chaosCacheDriver.alwaysThrow()

    const options = new CacheEntryOptions({ suppressL2Errors: false })

    await assert.rejects(() => cache.get('foo', options))
    await assert.rejects(() => cache.set('foo', 'bar', options))
    await assert.rejects(() => cache.delete('foo', options))
    await assert.rejects(() => cache.deleteMany(['foo'], options))
    await assert.rejects(() => cache.has('foo', options))

    assert.deepEqual(logger.logs.length, 5)
  })

  test('should ignore errors if suppressL2Errors is enabled', async ({ assert }) => {
    const logger = new TestLogger()
    const chaosCacheDriver = new ChaosCache(new Memory())
    const cache = new RemoteCache(chaosCacheDriver, logger)

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
