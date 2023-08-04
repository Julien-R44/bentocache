/*
 * @adonisjs/cache
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { test } from '@japa/runner'
import { IgnitorFactory } from '@adonisjs/core/factories'

import { defineConfig } from '../index.js'
import { Memory } from '../src/drivers/memory.js'
import { Redis } from '../src/drivers/redis.js'
import driversList from '../src/drivers_list.js'
import { REDIS_CREDENTIALS } from '../test_helpers/index.js'

const BASE_URL = new URL('./tmp/', import.meta.url)

test.group('Cache Provider', (group) => {
  group.each.teardown(() => {
    driversList.list = {}
  })

  test('only register configured drivers', async ({ assert, cleanup }) => {
    const ignitor = new IgnitorFactory()
      .withCoreProviders()
      .merge({
        rcFileContents: {
          providers: ['../providers/cache_provider.js'],
        },
        config: {
          cache: defineConfig({
            default: 'redis',
            list: {
              redis: {
                driver: 'redis',
                ttl: 1000,
                connection: REDIS_CREDENTIALS,
              },
            },
          }),
        },
      })
      .create(BASE_URL, { importer: (filePath) => import(filePath) })

    const app = ignitor.createApp('web')
    await app.init()
    await app.boot()

    await app.container.make('cache')

    const redisInstance = driversList.create('redis', {
      connection: REDIS_CREDENTIALS,
      ttl: 100,
    })

    cleanup(() => redisInstance.disconnect())

    assert.instanceOf(redisInstance, Redis)
    assert.throws(
      () => driversList.create('memory', {} as any),
      'Unknown cache driver "memory". Make sure the driver is registered'
    )
    assert.throws(
      () => driversList.create('file', {} as any),
      'Unknown cache driver "file". Make sure the driver is registered'
    )
  })

  test('register all drivers', async ({ assert, cleanup }) => {
    const ignitor = new IgnitorFactory()
      .withCoreProviders()
      .merge({
        rcFileContents: {
          providers: ['../providers/cache_provider.js'],
        },
        config: {
          cache: defineConfig({
            default: 'redis',
            list: {
              redis: {
                driver: 'redis',
                ttl: 1000,
                connection: REDIS_CREDENTIALS,
              },
              memory: {
                driver: 'memory',
                ttl: 1000,
                maxSize: 1000,
              },
            },
          }),
        },
      })
      .create(BASE_URL, { importer: (filePath) => import(filePath) })

    const app = ignitor.createApp('web')
    await app.init()
    await app.boot()

    await app.container.make('cache')

    const redisInstance = driversList.create('redis', {
      connection: REDIS_CREDENTIALS,
      ttl: 100,
    })
    cleanup(() => redisInstance.disconnect())

    const memoryInstance = driversList.create('memory', {
      ttl: 100,
      maxSize: 1000,
    })

    assert.instanceOf(redisInstance, Redis)
    assert.instanceOf(memoryInstance, Memory)
  })

  test('define repl bindings', async ({ assert }) => {
    const ignitor = new IgnitorFactory()
      .withCoreConfig()
      .merge({
        rcFileContents: {
          providers: ['../providers/cache_provider.js'],
        },
      })
      .withCoreProviders()
      .create(BASE_URL, { importer: (filePath) => import(filePath) })

    const app = ignitor.createApp('repl')
    await app.init()
    await app.boot()

    const repl = await app.container.make('repl')
    assert.property(repl.getMethods(), 'loadCache')
    assert.isFunction(repl.getMethods().loadCache.handler)
  })

  test('dont define repl bindings in web environment', async ({ assert }) => {
    const ignitor = new IgnitorFactory()
      .withCoreConfig()
      .merge({
        rcFileContents: {
          providers: ['../providers/cache_provider.js'],
        },
      })
      .withCoreProviders()
      .create(BASE_URL, { importer: (filePath) => import(filePath) })

    const app = ignitor.createApp('web')
    await app.init()
    await app.boot()

    const repl = await app.container.make('repl')
    assert.isUndefined(repl.getMethods().loadCache)
  })

  test('disconnect all drivers on app termination', async ({ assert }) => {
    const ignitor = new IgnitorFactory()
      .withCoreProviders()
      .merge({
        rcFileContents: {
          providers: ['../providers/cache_provider.js'],
        },
        config: {
          cache: defineConfig({
            default: 'redis',
            list: {
              redis: {
                driver: 'redis',
                ttl: 1000,
                connection: REDIS_CREDENTIALS,
              },
            },
          }),
        },
      })
      .create(BASE_URL, { importer: (filePath) => import(filePath) })

    const app = ignitor.createApp('web')
    await app.init()
    await app.boot()

    const cache = await app.container.make('cache')
    assert.isUndefined(await cache.get('foo'))

    await app.terminate()
  })
})
