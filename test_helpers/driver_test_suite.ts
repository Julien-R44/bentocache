import type { test as JapaTest } from '@japa/runner'

import { setTimeout } from 'node:timers/promises'

import type { CacheDriver } from '../src/types/main.js'

type CacheDriverConstructor = {
  new (config: any): CacheDriver<any>
}

export function registerApiTestSuite<T extends CacheDriverConstructor>({
  name,
  test,
  driver,
  config,
  eachSetup,
  eachTeardown,
  setup,
  teardown,
  supportsMilliseconds = true,
}: {
  test: typeof JapaTest
  driver: T
  config: ConstructorParameters<T>[0]

  /**
   * Name of the driver
   */
  name?: string

  /**
   * Setup hook to be invoked before each test
   */
  eachSetup?: () => Promise<void>

  /**
   * Teardown hook to be invoked after each test
   */
  eachTeardown?: () => Promise<void>

  /**
   * Setup hook to be invoked before the test suite
   */
  setup?: () => Promise<void>

  /**
   * Teardown hook to be invoked after the test suite
   */
  teardown?: () => Promise<void>

  /**
   * If the driver support milliseconds for TTLs
   */
  supportsMilliseconds?: boolean
}) {
  name = name || driver.prototype.constructor.name
  const sleepTime = supportsMilliseconds ? 20 : 1000

  test.group(`Cache API compliance - ${name}`, (group) => {
    let cache: CacheDriver

    group.tap((t) => t.disableTimeout().retry(3))

    group.setup(async () => {
      await setup?.()
    })

    group.teardown(async () => {
      await teardown?.()
    })

    group.each.setup(async () => {
      cache = new driver(config)

      await eachSetup?.()

      return async () => {
        await cache.clear()
        await cache.disconnect()
      }
    })

    group.each.teardown(async () => {
      await eachTeardown?.()
    })

    test('get() returns undefined when key does not exists', async ({ assert }) => {
      assert.deepEqual(await cache.get('key'), undefined)
    })

    test('get() returns value', async ({ assert }) => {
      await cache.set('key', 'value')
      assert.deepEqual(await cache.get('key'), 'value')
    })

    test('set() store a value', async ({ assert }) => {
      await cache.set('key', 'value')
      assert.deepEqual(await cache.get('key'), 'value')
    })

    test('set() store a value with expiration', async ({ assert }) => {
      await cache.delete('key')

      await cache.set('key', 'value', 1500)
      assert.deepEqual(await cache.get('key'), 'value')

      await setTimeout(2500)
      assert.deepEqual(await cache.get('key'), undefined)
    })

    test('set() returns true when value is set', async ({ assert }) => {
      const result = await cache.set('key', 'value')
      assert.isTrue(result)
    })

    test('clear() remove all keys', async ({ assert }) => {
      await cache.set('key1', 'value1')
      await cache.set('key2', 'value2', 60000)

      await cache.clear()

      assert.deepEqual(await cache.get('key1'), undefined)
      assert.deepEqual(await cache.get('key2'), undefined)
    })

    test('clear() remove only keys with prefix', async ({ assert, cleanup }) => {
      const cache2 = new driver({ ...config, prefix: 'prefix' })
      cleanup(async () => {
        await cache2.clear()
        await cache2.disconnect()
      })

      await cache2.set('key1', 'value1')

      await cache.clear()

      assert.deepEqual(await cache2.get('key1'), 'value1')
    })

    test('delete() removes a key', async ({ assert }) => {
      await cache.set('key1', 'value1')
      await cache.delete('key1')
      assert.deepEqual(await cache.get('key1'), undefined)
    })

    test('deleteMany() removes many keys', async ({ assert }) => {
      await cache.set('key1', 'value1')
      await cache.set('key2', 'value2')

      await cache.deleteMany(['key1', 'key2'])

      assert.deepEqual(await cache.get('key1'), undefined)
      assert.deepEqual(await cache.get('key2'), undefined)
    })

    test('delete() returns true when key is removed', async ({ assert }) => {
      await cache.set('key1', 'value1')
      const result = await cache.delete('key1')
      assert.isTrue(result)
    })

    test('delete() returns false when key does not exists', async ({ assert }) => {
      const result = await cache.delete('key1')
      assert.isFalse(result)
    })

    test('has() returns true when key exists', async ({ assert }) => {
      await cache.set('key1', 'value1')
      assert.isTrue(await cache.has('key1'))
    })

    test('has() returns false when key does not exists', async ({ assert }) => {
      assert.isFalse(await cache.has('key1'))
    })

    test('has() should not returns true for expired key', async ({ assert }) => {
      await cache.set('key1', 'value1', 10)

      await setTimeout(sleepTime)
      assert.isFalse(await cache.has('key1'))
    })

    test('pull() returns value and removes it', async ({ assert }) => {
      await cache.set('key1', 'foo')
      const value = await cache.pull('key1')
      assert.deepEqual(value, 'foo')
    })

    test('pull() returns undefined when key does not exists', async ({ assert }) => {
      const value = await cache.pull('key1')
      assert.isUndefined(value)
    })

    test('namespace() returns a new instance', async ({ assert }) => {
      const cache2 = cache.namespace('foo')
      assert.notEqual(cache, cache2)
    })

    test('set() value on namespace', async ({ assert }) => {
      const fooNamespace = cache.namespace('foo')

      await fooNamespace.set('key1', 'value1')
      assert.deepEqual(await cache.get('key1'), undefined)
      assert.deepEqual(await fooNamespace.get('key1'), 'value1')
    })

    test('get() value from namespace', async ({ assert }) => {
      const fooNamespace = cache.namespace('foo')

      await cache.set('key1', 'value1')
      await fooNamespace.set('key1', 'value2')

      assert.deepEqual(await cache.get('key1'), 'value1')
      assert.deepEqual(await fooNamespace.get('key1'), 'value2')
    })

    test('clear() should only clear namespaces items', async ({ assert }) => {
      const fooNamespace = cache.namespace('foo')

      await cache.set('key1', 'value1')
      await fooNamespace.set('key2', 'value2')

      await fooNamespace.clear()
      assert.deepEqual(await cache.get('key1'), 'value1')
      assert.isUndefined(await fooNamespace.get('key2'))
    })

    test('clear() on root cache should clear namespaces items too', async ({ assert }) => {
      const fooNamespace = cache.namespace('foo')

      await cache.set('key1', 'value1')
      await fooNamespace.set('key2', 'value2')

      await cache.clear()

      assert.isUndefined(await cache.get('key1'))
      assert.isUndefined(await fooNamespace.get('key2'))
    })

    test('should be able to access namespaced key from root if prefixed', async ({ assert }) => {
      const users = cache.namespace('users')
      const usersPosts = users.namespace('posts')

      users.set('key1', 'value1')
      usersPosts.set('key1', 'value2')

      const r1 = await cache.get('users:key1')
      const r2 = await usersPosts.get('key1')
      const r3 = await users.get('posts:key1')
      const r4 = await cache.get('users:posts:key1')

      assert.deepEqual(r1, 'value1')
      assert.deepEqual(r2, 'value2')
      assert.deepEqual(r3, 'value2')
      assert.deepEqual(r4, 'value2')
    })
  })
}
