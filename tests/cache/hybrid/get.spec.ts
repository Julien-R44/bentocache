import { test } from '@japa/runner'
import { CacheFactory } from '../../../factories/cache_factory.js'
import { NullDriver } from '../../../src/drivers/null.js'

test.group('Get', () => {
  test('Value not in local but in remote', async ({ assert, cleanup }) => {
    const { cache, remote } = new CacheFactory().withHybridConfig().create()

    await remote.set('foo', JSON.stringify({ value: 'bar' }))
    const value = await cache.get('foo')
    assert.deepEqual(value, 'bar')
  })

  test('value not in local and not in remote should returns undefined', async ({ assert }) => {
    const { cache } = new CacheFactory().withHybridConfig().create()
    const value = await cache.get('foo')

    assert.isUndefined(value)
  })

  test('value only in local should returns value without fetching from remote', async ({
    assert,
  }) => {
    class RemoteDriver extends NullDriver {
      get(): undefined {
        assert.fail('should not be called')
      }
    }

    const { cache, local } = new CacheFactory().withHybridConfig(new RemoteDriver({})).create()

    await local.set('foo', JSON.stringify({ value: 'bar' }))
    const value = await cache.get('foo')
    assert.deepEqual(value, 'bar')
  })

  test('return remote item if logically expired and retain is enabled', async ({ assert }) => {
    const { cache, remote } = new CacheFactory()
      .withHybridConfig()
      .merge({ gracefulRetain: { enabled: true } })
      .create()

    await remote.set('foo', JSON.stringify({ value: 'bar', logicalExpiration: Date.now() - 1000 }))
    const value = await cache.get('foo')

    assert.deepEqual(value, 'bar')
  })

  test('doesnt return remote item if logically expired and retain is disabled', async ({
    assert,
  }) => {
    const { cache, remote } = new CacheFactory()
      .withHybridConfig()
      .merge({ gracefulRetain: { enabled: false } })
      .create()

    await remote.set('foo', JSON.stringify({ value: 'bar', logicalExpiration: Date.now() - 1000 }))
    const value = await cache.get('foo')

    assert.isUndefined(value)
  })

  test('return local item if logically expired and retain is enabled', async ({ assert }) => {
    const { cache, local } = new CacheFactory()
      .withHybridConfig()
      .merge({ gracefulRetain: { enabled: true } })
      .create()

    await local.set('foo', JSON.stringify({ value: 'bar', logicalExpiration: Date.now() - 1000 }))
    const value = await cache.get('foo')

    assert.deepEqual(value, 'bar')
  })

  test('doesnt return local item if logically expired and retain is disabled', async ({
    assert,
  }) => {
    const { cache, local } = new CacheFactory()
      .withHybridConfig()
      .merge({ gracefulRetain: { enabled: false } })
      .create()

    await local.set('foo', JSON.stringify({ value: 'bar', logicalExpiration: Date.now() - 1000 }))
    const value = await cache.get('foo')

    assert.isUndefined(value)
  })

  test('set item to local store if found in remote', async ({ assert }) => {
    const { cache, local, remote } = new CacheFactory().withHybridConfig().create()

    await remote.set('foo', JSON.stringify({ value: 'bar' }))
    await cache.get('foo')

    const value = await local.get('foo')
    assert.deepEqual(value, JSON.stringify({ value: 'bar' }))
  })

  test('return default value if item not found in local and remote', async ({ assert }) => {
    const { cache } = new CacheFactory().withHybridConfig().create()

    const value = await cache.get('foo', 'bar')
    assert.deepEqual(value, 'bar')
  })
})
