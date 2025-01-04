import { test } from '@japa/runner'

import { TestLogger } from '../helpers/test_logger.js'
import { MemoryDriver } from '../../src/drivers/memory.js'
import { JsonSerializer } from '../../src/serializers/json.js'
import { LocalCache } from '../../src/cache/facades/local_cache.js'
import { CacheEntryOptions } from '../../src/cache/cache_entry/cache_entry_options.js'

test.group('Local Cache', () => {
  test('logically expire should works', ({ assert }) => {
    const localCache = new LocalCache(new MemoryDriver(), new TestLogger(), new JsonSerializer())
    const options = new CacheEntryOptions({ ttl: '30m' })

    const logicalExpiration = Date.now() + 1000 * 60 * 30
    const value = JSON.stringify({ value: 'bar', logicalExpiration })

    localCache.set('foo', value, options)
    const entry = localCache.get('foo', options)!

    localCache.logicallyExpire('foo')

    const entryUpdated = localCache.get('foo', options)

    assert.isFalse(entry.isLogicallyExpired())
    assert.isTrue(entryUpdated?.isLogicallyExpired())
  })

  test('logically expire should keep the same physical ttl', ({ assert }) => {
    const driver = new MemoryDriver()
    const localCache = new LocalCache(driver, new TestLogger(), new JsonSerializer())
    const options = new CacheEntryOptions({ ttl: '30m' })

    const logicalExpiration = Date.now() + 1000 * 60 * 30
    const remainingTtl = logicalExpiration - Date.now()
    const value = JSON.stringify({ value: 'bar', logicalExpiration })

    localCache.set('foo', value, options)
    localCache.logicallyExpire('foo')

    assert.closeTo(driver.getRemainingTtl('foo'), remainingTtl, 100)
  })
})
