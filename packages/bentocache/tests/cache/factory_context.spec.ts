import dayjs from 'dayjs'
import { test } from '@japa/runner'
import { sleep } from '@julr/utils/misc'

import { sequentialFactory } from '../helpers/index.js'
import { CacheFactory } from '../../factories/cache_factory.js'

test.group('Factory Context', () => {
  test('set TTL', async ({ assert }) => {
    const { cache, local, stack } = new CacheFactory().withMemoryL1().merge({ ttl: '10m' }).create()

    await cache.getOrSet({
      key: 'key1',
      ttl: '4m',
      factory: (options) => {
        options.setOptions({ ttl: '2d' })
        return { foo: 'bar' }
      },
    })

    const res = local.get('key1', stack.defaultOptions)!
    const logicalExpiration = res.entry.getLogicalExpiration()

    const inTwoDays = dayjs().add(2, 'day')
    assert.isTrue(dayjs(logicalExpiration).isSame(inTwoDays, 'day'))
  })

  test('should be able to skip bus notify', async ({ assert }) => {
    const [cache1, local1, , stack1] = new CacheFactory().withL1L2Config().create()
    const [cache2] = new CacheFactory().withL1L2Config().create()

    await cache1.set({ key: 'foo', value: 'bar', ttl: 200, grace: '2h' })
    await cache2.get({ key: 'foo' })

    await sleep(210)
    await cache2.getOrSet({
      key: 'foo',
      factory: (ctx) => {
        ctx.setOptions({ skipBusNotify: true })

        return 'baz'
      },
    })

    const r1 = local1.get('foo', stack1.defaultOptions)
    const r2 = await cache2.get({ key: 'foo' })

    assert.deepEqual(r1?.entry.getValue(), 'bar')
    assert.deepEqual(r2, 'baz')
  })

  test('should be able to skip l2 write', async ({ assert }) => {
    const [cache1] = new CacheFactory().withL1L2Config().create()
    const [cache2] = new CacheFactory().withL1L2Config().create()

    await cache1.getOrSet({
      key: 'foo',
      factory: (ctx) => {
        ctx.setOptions({ skipL2Write: true })

        return 'bar'
      },
    })

    const r1 = await cache2.get({ key: 'foo' })

    assert.isUndefined(r1)
  })

  test('do not cache if skip is returned', async ({ assert }) => {
    const { cache } = new CacheFactory().withL1L2Config().create()

    const factory = sequentialFactory([({ skip }) => skip(), () => 'bar'])

    const r1 = await cache.getOrSet({ key: 'foo', factory })
    const r2 = await cache.getOrSet({ key: 'foo', factory })

    assert.deepEqual(factory.callsCount(), 2)
    assert.deepEqual(r1, undefined)
    assert.deepEqual(r2, 'bar')
  })

  test('do not use graced value if skip is returned', async ({ assert }) => {
    const { cache } = new CacheFactory()
      .merge({ timeout: '2s', grace: '2m' })
      .withL1L2Config()
      .create()

    const factory = sequentialFactory([() => 'bar', ({ skip }) => skip()])

    const r1 = await cache.getOrSet({ key: 'foo', factory, ttl: 10 })
    await sleep(50)
    const r2 = await cache.getOrSet({ key: 'foo', factory })

    assert.deepEqual(factory.callsCount(), 2)
    assert.deepEqual(r1, 'bar')
    assert.deepEqual(r2, undefined)
  })

  test('can access graced entry', async ({ assert }) => {
    assert.plan(2)

    const { cache } = new CacheFactory().withL1L2Config().merge({ grace: '2m' }).create()

    await cache.getOrSet({
      key: 'foo',
      ttl: 100,
      factory: () => 'bar',
    })

    await sleep(100)

    const r1 = await cache.getOrSet({
      key: 'foo',
      factory: ({ gracedEntry }) => {
        assert.deepEqual(gracedEntry?.value, 'bar')
        return gracedEntry?.value
      },
    })

    assert.deepEqual(r1, 'bar')
  })
})
