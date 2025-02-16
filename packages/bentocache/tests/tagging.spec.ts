import { test } from '@japa/runner'

import { CacheFactory } from '../factories/cache_factory.js'
import { createCacheEntryOptions } from '../src/cache/cache_entry/cache_entry_options.js'

test.group('Tagging | Internals', () => {
  test('deleteByTag should store invalidated tags with timestamps', async ({ assert }) => {
    const { cache } = new CacheFactory().withL1L2Config().create()
    await cache.deleteByTag({ tags: ['tag1', 'tag2'] })
    const r1 = await cache.get({ key: '___bc:t:tag1' })
    const r2 = await cache.get({ key: '___bc:t:tag1' })

    assert.isNotNull(r1)
    assert.isNotNull(r2)
  })

  test('set should store value with tags', async ({ assert }) => {
    const { cache, local, remote } = new CacheFactory().withL1L2Config().create()

    await cache.set({ key: 'key1', value: 'value1', tags: ['tag1', 'tag2'] })

    const r1 = local.get('key1', createCacheEntryOptions())
    const r2 = await remote.get('key1', createCacheEntryOptions())

    assert.deepEqual(r1?.entry.getTags(), ['tag1', 'tag2'])
    assert.deepEqual(r2?.entry.getTags(), ['tag1', 'tag2'])
  })
})

test.group('Tagging | deleteByTag', () => {
  test('basic', async ({ assert }) => {
    const { cache } = new CacheFactory().withL1L2Config().create()

    await cache.set({ key: 'key1', value: 'value1', tags: ['tag1'] })
    await cache.deleteByTag({ tags: ['tag1'] })

    const r1 = await cache.get({ key: 'key1' })
    assert.deepEqual(r1, undefined)
  })

  test('can remove by tag', async ({ assert }) => {
    const { cache } = new CacheFactory().withL1L2Config().create()

    await cache.set({ key: 'foo', value: 1, tags: ['x', 'y'] })
    await cache.set({ key: 'bar', value: 2, tags: ['y', 'z'] })
    await cache.getOrSet({ key: 'baz', factory: () => 3, tags: ['x', 'z'] })

    const r1 = await cache.getOrSet({ key: 'foo', factory: () => 11, tags: ['x', 'y'] })
    const r2 = await cache.getOrSet({ key: 'bar', factory: () => 22, tags: ['y', 'z'] })
    const r3 = await cache.getOrSet({
      key: 'baz',
      factory: (ctx) => {
        ctx.setTags(['x', 'z'])
        return 33
      },
    })

    assert.deepEqual(r1, 1)
    assert.deepEqual(r2, 2)
    assert.deepEqual(r3, 3)

    await cache.deleteByTag({ tags: ['x'] })

    const r4 = await cache.get({ key: 'foo' })
    const r5 = await cache.getOrSet({ key: 'bar', factory: () => 222, tags: ['y', 'z'] })
    const r6 = await cache.getOrSet({ key: 'baz', factory: () => 333, tags: ['x', 'z'] })

    assert.isUndefined(r4)
    assert.deepEqual(r5, 2)
    assert.deepEqual(r6, 333)

    await cache.deleteByTag({ tags: ['y'] })

    const r7 = await cache.getOrSet({ key: 'foo', factory: () => 1111, tags: ['x', 'y'] })
    const r8 = await cache.getOrSet({ key: 'bar', factory: () => 2222, tags: ['y', 'z'] })
    const r9 = await cache.getOrSet({ key: 'baz', factory: () => 3333, tags: ['x', 'z'] })

    assert.deepEqual(r7, 1111)
    assert.deepEqual(r8, 2222)
    assert.deepEqual(r9, 333)
  })

  test('can remove multiple tags', async ({ assert }) => {
    const { cache } = new CacheFactory().withL1L2Config().create()

    await cache.set({ key: 'foo', value: 1, tags: ['x', 'y'] })
    await cache.set({ key: 'bar', value: 2, tags: ['y'] })
    await cache.getOrSet({ key: 'baz', factory: () => 3, tags: ['z'] })

    const foo1 = await cache.get({ key: 'foo' })
    const bar1 = await cache.get({ key: 'bar' })
    const baz1 = await cache.get({ key: 'baz' })

    assert.deepEqual(foo1, 1)
    assert.deepEqual(bar1, 2)
    assert.deepEqual(baz1, 3)

    await cache.deleteByTag({ tags: ['x', 'z'] })

    const foo2 = await cache.get({ key: 'foo' })
    const bar2 = await cache.get({ key: 'bar' })
    const baz2 = await cache.get({ key: 'baz' })

    assert.isUndefined(foo2)
    assert.deepEqual(bar2, 2)
    assert.isUndefined(baz2)

    await cache.deleteByTag({ tags: [] })

    const foo4 = await cache.get({ key: 'foo' })
    const bar4 = await cache.get({ key: 'bar' })
    const baz4 = await cache.get({ key: 'baz' })

    assert.isUndefined(foo4)
    assert.deepEqual(bar4, 2)
    assert.isUndefined(baz4)

    await cache.deleteByTag({ tags: ['y', 'non-existing'] })

    const foo5 = await cache.get({ key: 'foo' })
    const bar5 = await cache.get({ key: 'bar' })
    const baz5 = await cache.get({ key: 'baz' })

    assert.isUndefined(foo5)
    assert.isUndefined(bar5)
    assert.isUndefined(baz5)
  })

  test('remove by tags with bus', async ({ assert }) => {
    const [cache1] = new CacheFactory().withL1L2Config().create()
    const [cache2] = new CacheFactory().withL1L2Config().create()
    const [cache3] = new CacheFactory().withL1L2Config().create()

    await cache1.set({ key: 'foo', value: 1, tags: ['x', 'y'] })
    await cache2.set({ key: 'bar', value: 2, tags: ['y', 'z'] })
    await cache3.getOrSet({ key: 'baz', factory: () => 3, tags: ['x', 'z'] })

    const foo1 = await cache1.getOrSet({ key: 'foo', factory: () => 11, tags: ['x', 'y'] })
    const bar1 = await cache2.getOrSet({ key: 'bar', factory: () => 22, tags: ['y', 'z'] })
    const baz1 = await cache3.getOrSet({ key: 'baz', factory: () => 33, tags: ['x', 'z'] })

    assert.deepEqual(foo1, 1)
    assert.deepEqual(bar1, 2)
    assert.deepEqual(baz1, 3)

    await cache1.deleteByTag({ tags: ['x'] })

    const foo2 = await cache1.get({ key: 'foo' })
    const bar2 = await cache2.getOrSet({ key: 'bar', factory: () => 222, tags: ['y', 'z'] })
    const baz2 = await cache3.getOrSet({ key: 'baz', factory: () => 333, tags: ['x', 'z'] })

    assert.isUndefined(foo2)
    assert.deepEqual(bar2, 2)
    assert.deepEqual(baz2, 333)

    await cache2.deleteByTag({ tags: ['y'] })

    const foo3 = await cache1.getOrSet({ key: 'foo', factory: () => 1111, tags: ['x', 'y'] })
    const bar3 = await cache2.getOrSet({ key: 'bar', factory: () => 2222, tags: ['y', 'z'] })
    const baz3 = await cache3.getOrSet({ key: 'baz', factory: () => 3333, tags: ['x', 'z'] })

    assert.deepEqual(foo3, 1111)
    assert.deepEqual(bar3, 2222)
    assert.deepEqual(baz3, 333)
  })

  test('remove multiple tags with bus', async ({ assert }) => {
    const [cache1] = new CacheFactory().withL1L2Config().create()
    const [cache2] = new CacheFactory().withL1L2Config().create()
    const [cache3] = new CacheFactory().withL1L2Config().create()

    await cache1.set({ key: 'foo', value: 1, tags: ['x', 'y'] })
    await cache2.set({ key: 'bar', value: 2, tags: ['y'] })
    await cache3.getOrSet({ key: 'baz', factory: () => 3, tags: ['z'] })

    const cache1foo1 = await cache1.get({ key: 'foo' })
    const cache1bar1 = await cache1.get({ key: 'bar' })
    const cache1baz1 = await cache1.get({ key: 'baz' })

    assert.deepEqual(cache1foo1, 1)
    assert.deepEqual(cache1bar1, 2)
    assert.deepEqual(cache1baz1, 3)

    const cache2foo1 = await cache2.get({ key: 'foo' })
    const cache2bar1 = await cache2.get({ key: 'bar' })
    const cache2baz1 = await cache2.get({ key: 'baz' })

    assert.deepEqual(cache2foo1, 1)
    assert.deepEqual(cache2bar1, 2)
    assert.deepEqual(cache2baz1, 3)

    const cache3foo1 = await cache3.get({ key: 'foo' })
    const cache3bar1 = await cache3.get({ key: 'bar' })
    const cache3baz1 = await cache3.get({ key: 'baz' })

    assert.deepEqual(cache3foo1, 1)
    assert.deepEqual(cache3bar1, 2)
    assert.deepEqual(cache3baz1, 3)

    await cache1.deleteByTag({ tags: ['x', 'z'] })

    const cache2foo2 = await cache2.get({ key: 'foo' })
    const cache2bar2 = await cache2.get({ key: 'bar' })
    const cache2baz2 = await cache2.get({ key: 'baz' })

    assert.isUndefined(cache2foo2)
    assert.deepEqual(cache2bar2, 2)
    assert.isUndefined(cache2baz2)

    const cache3foo2 = await cache3.get({ key: 'foo' })
    const cache3bar2 = await cache3.get({ key: 'bar' })
    const cache3baz2 = await cache3.get({ key: 'baz' })

    assert.isUndefined(cache3foo2)
    assert.deepEqual(cache3bar2, 2)
    assert.isUndefined(cache3baz2)

    await cache3.deleteByTag({ tags: ['y', 'non-existing'] })

    const cache1foo3 = await cache1.get({ key: 'foo' })
    const cache1bar3 = await cache1.get({ key: 'bar' })
    const cache1baz3 = await cache1.get({ key: 'baz' })

    assert.isUndefined(cache1foo3)
    assert.isUndefined(cache1bar3)
    assert.isUndefined(cache1baz3)

    const cache2foo3 = await cache2.get({ key: 'foo' })
    const cache2bar3 = await cache2.get({ key: 'bar' })
    const cache2baz3 = await cache2.get({ key: 'baz' })

    assert.isUndefined(cache2foo3)
    assert.isUndefined(cache2bar3)
    assert.isUndefined(cache2baz3)

    const cache3foo3 = await cache3.get({ key: 'foo' })
    const cache3bar3 = await cache3.get({ key: 'bar' })
    const cache3baz3 = await cache3.get({ key: 'baz' })

    assert.isUndefined(cache3foo3)
    assert.isUndefined(cache3bar3)
    assert.isUndefined(cache3baz3)
  })

  test('tags and namespaces', async ({ assert }) => {
    const [cache1] = new CacheFactory().withL1L2Config().create()

    const users = cache1.namespace('users')
    const posts = cache1.namespace('posts')

    await users.set({ key: 'foo', value: 1, tags: ['x'] })
    await cache1.set({ key: 'bar', value: 2, tags: ['x'] })
    await posts.set({ key: 'baz', value: 3, tags: ['x'] })

    await posts.deleteByTag({ tags: ['x'] })

    const userFoo1 = await users.get({ key: 'foo' })
    const postFoo1 = await posts.get({ key: 'baz' })
    const cacheFoo1 = await cache1.get({ key: 'bar' })

    assert.deepEqual(userFoo1, 1)
    assert.isUndefined(postFoo1)
    assert.deepEqual(cacheFoo1, 2)

    await cache1.deleteByTag({ tags: ['x'] })

    const usersFoo2 = await users.get({ key: 'foo' })
    const postsFoo2 = await posts.get({ key: 'baz' })
    const cacheFoo2 = await cache1.get({ key: 'bar' })

    assert.deepEqual(usersFoo2, 1)
    assert.isUndefined(postsFoo2)
    assert.isUndefined(cacheFoo2)

    await users.deleteByTag({ tags: ['x'] })

    const usersFoo3 = await users.get({ key: 'foo' })
    const postsFoo3 = await posts.get({ key: 'baz' })
    const cacheFoo3 = await cache1.get({ key: 'bar' })

    assert.isUndefined(usersFoo3)
    assert.isUndefined(postsFoo3)
    assert.isUndefined(cacheFoo3)
  })

  test('key created after tag invalidation should not be invalidated', async ({ assert }) => {
    const [cache] = new CacheFactory().withL1L2Config().create()

    await cache.set({ key: 'foo', value: 1, tags: ['x'] })
    await cache.deleteByTag({ tags: ['x', 'foo'] })
    await cache.set({ key: 'bar', value: 2, tags: ['x'] })

    const r1 = await cache.get({ key: 'foo' })
    const r2 = await cache.get({ key: 'bar' })

    assert.isUndefined(r1)
    assert.deepEqual(r2, 2)
  })
})
