import { test } from '@japa/runner'
import { setTimeout } from 'node:timers/promises'

import { CacheFactory } from '../../factories/cache_factory.js'
import { ChaosBus } from '../../test_helpers/chaos/chaos_bus.js'
import { MemoryBus } from '../../src/bus/drivers/memory_bus.js'

test.group('Bus synchronization', () => {
  test('Should works', async ({ assert }) => {
    const key = 'foo'

    const [cache1] = new CacheFactory().withHybridConfig().create()
    const [cache2] = new CacheFactory().withHybridConfig().create()
    const [cache3] = new CacheFactory().withHybridConfig().create()

    await setTimeout(1000)
    await cache1.set(key, 24)
    await setTimeout(1000)

    assert.equal(await cache1.get(key), 24)
    assert.equal(await cache2.get(key), 24)
    assert.equal(await cache3.get(key), 24)

    await cache1.delete(key)

    await setTimeout(1000)

    assert.isUndefined(await cache1.get(key))
    assert.isUndefined(await cache2.get(key))
    assert.isUndefined(await cache3.get(key))
  })

  test('retry queue processing', async ({ assert }) => {
    // TODO

    const bus1 = new ChaosBus(new MemoryBus())
    const bus2 = new ChaosBus(new MemoryBus())
    const bus3 = new ChaosBus(new MemoryBus())

    const [cache1] = new CacheFactory().withHybridConfig().merge({ busDriver: bus1 }).create()
    const [cache2] = new CacheFactory().withHybridConfig().merge({ busDriver: bus2 }).create()
    const [cache3] = new CacheFactory().withHybridConfig().merge({ busDriver: bus3 }).create()

    bus1.alwaysThrow()
    bus2.alwaysThrow()
    bus3.alwaysThrow()

    await setTimeout(100)

    await cache1.getOrSet('foo', async () => 1)
    await setTimeout(200)

    await cache2.getOrSet('foo', async () => 2)
    await setTimeout(200)

    await cache3.getOrSet('foo', async () => 3)
    await setTimeout(200)

    bus1.neverThrow()
    bus2.neverThrow()
    bus3.neverThrow()

    assert.deepEqual(await cache1.get('foo'), 1)
    assert.deepEqual(await cache2.get('foo'), 2)
    assert.deepEqual(await cache3.get('foo'), 3)
  }).skip()
})
