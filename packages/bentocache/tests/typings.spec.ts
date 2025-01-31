import { test } from '@japa/runner'

import { bentostore } from '../src/bento_store.js'
import { BentoCache } from '../src/bento_cache.js'
import { memoryDriver } from '../src/drivers/memory.js'
import type { Duration } from '../src/types/helpers.js'
import type { CacheEvents } from '../src/types/events.js'
import { CacheFactory } from '../factories/cache_factory.js'
import { BentoCacheFactory } from '../factories/bentocache_factory.js'
import type { FactoryTimeoutOptions, GracePeriodOptions } from '../src/types/main.js'

test.group('Typings', () => {
  test('named caches typings', async ({ expectTypeOf }) => {
    const bento = new BentoCache({
      default: 'primary',
      stores: {
        primary: bentostore().useL1Layer(memoryDriver({ maxItems: 100 })),
        secondary: bentostore().useL1Layer(memoryDriver({ maxItems: 100 })),
      },
    })

    expectTypeOf(bento.use).parameter(0).toEqualTypeOf<'primary' | 'secondary' | undefined>()
  })

  test('get() typings on cache', async ({ expectTypeOf }) => {
    const { cache } = new CacheFactory().create()

    const r1 = await cache.get<string>('key')
    const r2 = await cache.get('key', 'hey')
    const r3 = await cache.get('key', () => 'hey')
    const r4 = await cache.get('key', () => 10)
    const r5 = await cache.get('key', () => ({ foo: 'bar' }))
    const r6 = await cache.get('key', { bar: 'foo' })
    const r7 = await cache.get('key')

    expectTypeOf(r1).toEqualTypeOf<string | null | undefined>()
    expectTypeOf(r2).toEqualTypeOf<string>()
    expectTypeOf(r3).toEqualTypeOf<string>()
    expectTypeOf(r4).toEqualTypeOf<number>()
    expectTypeOf(r5).toEqualTypeOf<{ foo: string }>()
    expectTypeOf(r6).toEqualTypeOf<{ bar: string }>()
    expectTypeOf(r7).toEqualTypeOf<any>()
  })

  test('get() typings on bento', async ({ expectTypeOf }) => {
    const { bento } = new BentoCacheFactory().create()

    const r1 = await bento.get<string>('key')
    const r2 = await bento.get('key', 'hey')
    const r3 = await bento.get('key', () => 'hey')
    const r4 = await bento.get('key', () => 10)
    const r5 = await bento.get('key', () => ({ foo: 'bar' }))
    const r6 = await bento.get('key', { bar: 'foo' })
    const r7 = await bento.use('secondary').get('key', { bar: 'foo' })
    const r8 = await bento.get('key')

    expectTypeOf(r1).toEqualTypeOf<string | null | undefined>()
    expectTypeOf(r2).toEqualTypeOf<string>()
    expectTypeOf(r3).toEqualTypeOf<string>()
    expectTypeOf(r4).toEqualTypeOf<number>()
    expectTypeOf(r5).toEqualTypeOf<{ foo: string }>()
    expectTypeOf(r6).toEqualTypeOf<{ bar: string }>()
    expectTypeOf(r7).toEqualTypeOf<{ bar: string }>()
    expectTypeOf(r8).toEqualTypeOf<any>()
  })

  test('pull() typings on cache', async ({ expectTypeOf }) => {
    const { cache } = new CacheFactory().create()

    const r1 = await cache.pull<string>('key')
    const r2 = await cache.pull('key')

    expectTypeOf(r1).toEqualTypeOf<string | null | undefined>()
    expectTypeOf(r2).toEqualTypeOf<any>()
  })

  test('pull() typings on bento', async ({ expectTypeOf }) => {
    const { bento } = new BentoCacheFactory().create()

    const r1 = await bento.pull<string>('key')
    const r2 = await bento.pull('key')

    expectTypeOf(r1).toEqualTypeOf<string | null | undefined>()
    expectTypeOf(r2).toEqualTypeOf<any>()
  })

  test('getOrSet() typings on cache', async ({ expectTypeOf }) => {
    const { cache } = new CacheFactory().create()

    const r1 = await cache.getOrSet<string>('key', () => 'hey')
    const r2 = await cache.getOrSet('key', () => 32)
    const r3 = await cache.getOrSet('key', () => 50_000)
    const r4 = await cache.getOrSet({
      key: 'key',
      ttl: 1000,
      factory: () => 34,
    })

    expectTypeOf(r1).toEqualTypeOf<string>()
    expectTypeOf(r2).toEqualTypeOf<number>()
    expectTypeOf(r3).toEqualTypeOf<number>()
    expectTypeOf(r4).toEqualTypeOf<number>()
  })

  test('getOrSet() typings on bento', async ({ expectTypeOf }) => {
    const { bento } = new BentoCacheFactory().create()

    const r1 = await bento.getOrSet<string>('key', () => 'hey')
    const r2 = await bento.getOrSet('key', () => 32)
    const r3 = await bento.getOrSet('key', () => 50_000)
    const r4 = await bento.getOrSet({
      key: 'key',
      ttl: 1000,
      factory: () => 34,
    })

    expectTypeOf(r1).toEqualTypeOf<string>()
    expectTypeOf(r2).toEqualTypeOf<number>()
    expectTypeOf(r3).toEqualTypeOf<number>()
    expectTypeOf(r4).toEqualTypeOf<number>()
  })

  test('on() events list', async ({ expectTypeOf }) => {
    const { bento } = new BentoCacheFactory().create()

    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    expectTypeOf(bento.on).parameter(0).toEqualTypeOf<keyof CacheEvents>

    bento.on('cache:cleared', (payload) => {
      expectTypeOf(payload).toEqualTypeOf<CacheEvents['cache:cleared']>()
    })
  })

  test('getOrSet() options parameters typings', async ({ expectTypeOf }) => {
    const { bento } = new BentoCacheFactory().create()

    expectTypeOf(bento.getOrSet).parameter(2).exclude(undefined).toMatchTypeOf<{
      ttl?: Duration
      timeouts?: FactoryTimeoutOptions
      gracePeriod?: GracePeriodOptions
      suppressL2Errors?: boolean
      lockTimeout?: Duration
    }>()
  })

  test('get() options parameters typings', async ({ expectTypeOf }) => {
    const { bento } = new BentoCacheFactory().create()

    expectTypeOf(bento.get).parameter(2).exclude(undefined).not.toHaveProperty('lockTimeout')
    expectTypeOf(bento.get).parameter(2).exclude(undefined).not.toHaveProperty('timeouts')
  })

  test('delete() options parameters typings', async ({ expectTypeOf }) => {
    const { bento } = new BentoCacheFactory().create()

    expectTypeOf(bento.delete).parameter(1).exclude(undefined).not.toHaveProperty('lockTimeout')
    expectTypeOf(bento.delete).parameter(1).exclude(undefined).not.toHaveProperty('timeouts')
    expectTypeOf(bento.delete).parameter(2).exclude(undefined).toHaveProperty('suppressL2Errors')
  })

  test('deleteMany() options parameters typings', async ({ expectTypeOf }) => {
    const { bento } = new BentoCacheFactory().create()

    expectTypeOf(bento.deleteMany).parameter(1).exclude(undefined).not.toHaveProperty('lockTimeout')
    expectTypeOf(bento.deleteMany).parameter(1).exclude(undefined).not.toHaveProperty('timeouts')
    expectTypeOf(bento.deleteMany)
      .parameter(2)
      .exclude(undefined)
      .toHaveProperty('suppressL2Errors')
  })

  test('set() options parameters typings', async ({ expectTypeOf }) => {
    const { bento } = new BentoCacheFactory().create()

    expectTypeOf(bento.set).parameter(2).exclude(undefined).toMatchTypeOf<{
      ttl?: Duration
      timeouts?: FactoryTimeoutOptions
      gracePeriod?: GracePeriodOptions
      suppressL2Errors?: boolean
      lockTimeout?: Duration
    }>()
  })

  test('setForever() options parameters typings', async ({ expectTypeOf }) => {
    const { bento } = new BentoCacheFactory().create()

    expectTypeOf(bento.setForever).parameter(2).exclude(undefined).toMatchTypeOf<{
      ttl?: Duration
      timeouts?: FactoryTimeoutOptions
      gracePeriod?: GracePeriodOptions
      suppressL2Errors?: boolean
      lockTimeout?: Duration
    }>()
  })

  test('stores entries should accept raw options', async ({ expectTypeOf }) => {
    expectTypeOf(bentostore).toBeCallableWith({ gracePeriod: { enabled: true } })
  })

  test('cant pass ttl when using getOrSetForever', async () => {
    const { bento } = new BentoCacheFactory().create()

    bento.getOrSetForever({
      key: 'foo',
      factory: () => 'bar',
      // @ts-expect-error - should not accept ttl
      ttl: 100,
    })

    // @ts-expect-error - should not accept ttl
    bento.getOrSetForever('foo', () => 'bar', { ttl: 100 })
  })
})
