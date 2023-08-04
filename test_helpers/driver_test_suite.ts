/*
 * @adonisjs/cache
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import type { test as JapaTest } from '@japa/runner'
import type { CacheDriver } from '../src/types/main.js'
import { setTimeout } from 'node:timers/promises'

type CacheDriverConstructor = {
  new (config: any): CacheDriver
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
      await cache.set('key', 'value', 10)
      assert.deepEqual(await cache.get('key'), 'value')

      await setTimeout(sleepTime)
      assert.deepEqual(await cache.get('key'), undefined)
    })

    test('set() returns true when value is set', async ({ assert }) => {
      const result = await cache.set('key', 'value')
      assert.isTrue(result)
    })

    test('setMany() should insert items', async ({ assert }) => {
      await cache.setMany([
        { key: 'key1', value: 'value1' },
        { key: 'key2', value: 'value2' },
      ])

      assert.deepEqual(await cache.get('key1'), 'value1')
      assert.deepEqual(await cache.get('key2'), 'value2')
    })

    test('setMany() with expiration', async ({ assert, cleanup }) => {
      const cache2 = new driver(config)
      cleanup(async () => {
        await cache2.clear()
        await cache2.disconnect()
      })

      await cache2.setMany(
        [
          { key: 'key1', value: 'value1' },
          { key: 'key2', value: 'value2' },
        ],
        10
      )

      await setTimeout(sleepTime)
      assert.deepEqual(await cache2.get('key1'), undefined)
      assert.deepEqual(await cache2.get('key2'), undefined)
    })

    test('setMany() returns true when values are set', async ({ assert }) => {
      const result = await cache.setMany([
        { key: 'key1', value: 'value1' },
        { key: 'key2', value: 'value2' },
      ])

      assert.isTrue(result)
    })

    test('getMany() returns array of key/values', async ({ assert }) => {
      await cache.setMany([
        { key: 'key1', value: 'value1' },
        { key: 'key2', value: 'value2' },
      ])

      const result = await cache.getMany(['key1', 'key2'])
      assert.deepEqual(result, [
        { key: 'key1', value: 'value1' },
        { key: 'key2', value: 'value2' },
      ])
    })

    test('getMany() returns undefined value for missing keys', async ({ assert }) => {
      await cache.setMany([
        { key: 'key1', value: 'value1' },
        { key: 'key2', value: 'value2' },
      ])

      const result = await cache.getMany(['key1', 'key3', 'key2'])

      assert.deepEqual(result, [
        { key: 'key1', value: 'value1' },
        { key: 'key3', value: undefined },
        { key: 'key2', value: 'value2' },
      ])
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
  })
}
