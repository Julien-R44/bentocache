import { test } from '@japa/runner'
import { CacheFactory } from '../../../factories/cache_factory.js'
import { CacheItem } from '../../../src/cache_item.js'

test.group('Set', () => {
  test('A set() set item in local and remote store', async ({ assert }) => {
    const { cache, local, remote } = new CacheFactory().withHybridConfig().create()

    await cache.set('foo', 'bar')

    const r1 = CacheItem.fromDriver('foo', await local.get('foo'))
    const r2 = CacheItem.fromDriver('foo', (await remote.get('foo'))!)

    assert.deepEqual(r1.getValue(), 'bar')
    assert.deepEqual(r2.getValue(), 'bar')
  })

  test('set should use default CacheOptions', async ({ assert }) => {
    const { cache, local, remote } = new CacheFactory()
      .withHybridConfig()
      .merge({ earlyExpiration: 0.5, ttl: 60 * 1000 })
      .create()

    await cache.set('foo', 'bar')

    const r1 = CacheItem.fromDriver('foo', await local.get('foo'))
    const r2 = CacheItem.fromDriver('foo', (await remote.get('foo'))!)

    const earlyExpiration = Date.now() + 30 * 1000

    assert.closeTo(r1.getEarlyExpiration(), earlyExpiration, 100)
    assert.closeTo(r2.getEarlyExpiration(), earlyExpiration, 100)
  })

  test('could override default CacheOptions', async ({ assert }) => {
    const { cache, local, remote } = new CacheFactory()
      .withHybridConfig()
      .merge({ earlyExpiration: 0.5, ttl: 60 * 1000 })
      .create()

    await cache.set('foo', 'bar', { earlyExpiration: 0.25 })

    const r1 = CacheItem.fromDriver('foo', await local.get('foo'))
    const r2 = CacheItem.fromDriver('foo', (await remote.get('foo'))!)

    const earlyExpiration = Date.now() + 15 * 1000

    assert.closeTo(r1.getEarlyExpiration(), earlyExpiration, 100)
    assert.closeTo(r2.getEarlyExpiration(), earlyExpiration, 100)
  })
})
