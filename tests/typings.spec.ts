import { test } from '@japa/runner'
import { CacheFactory } from '../factories/cache_factory.js'
import { BentoCacheFactory } from '../factories/bentocache_factory.js'
import { CacheManager } from '../src/cache_manager.js'
import { memoryDriver } from '../src/drivers/memory.js'
import type { CacheEvents } from '../src/types/events.js'

test.group('Typings', () => {
  test('named caches typings', async ({ expectTypeOf }) => {
    const bento = new CacheManager({
      default: 'primary',
      stores: {
        primary: memoryDriver({ maxSize: 100, ttl: 30_000 }),
        secondary: memoryDriver({ maxSize: 100, ttl: 30_000 }),
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

    const r1 = await cache.getOrSet<string>('key', 'hey')
    const r2 = await cache.getOrSet('key', () => 32)
    const r3 = await cache.getOrSet('key', '50s', 50_000)

    expectTypeOf(r1).toEqualTypeOf<string>()
    expectTypeOf(r2).toEqualTypeOf<number>()
    expectTypeOf(r3).toEqualTypeOf<number>()
  })

  test('getOrSet() typings on bento', async ({ expectTypeOf }) => {
    const { bento } = new BentoCacheFactory().create()

    const r1 = await bento.getOrSet<string>('key', 'hey')
    const r2 = await bento.getOrSet('key', () => 32)
    const r3 = await bento.getOrSet('key', '50s', 50_000)

    expectTypeOf(r1).toEqualTypeOf<string>()
    expectTypeOf(r2).toEqualTypeOf<number>()
    expectTypeOf(r3).toEqualTypeOf<number>()
  })

  test('on() events list', async ({ expectTypeOf }) => {
    const { bento } = new BentoCacheFactory().create()

    expectTypeOf(bento.on).parameter(0).toEqualTypeOf<keyof CacheEvents>

    bento.on('cache:cleared', (payload) => {
      expectTypeOf(payload).toEqualTypeOf<CacheEvents['cache:cleared']>()
    })
  })
})
