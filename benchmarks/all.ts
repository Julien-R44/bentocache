import 'dotenv/config'

import Keyv from 'keyv'
import { Bench } from 'tinybench'
import KeyvRedis from '@keyv/redis'
import { createCache } from 'cache-manager'
import { CacheableMemory } from 'cacheable'

import { getFromDb } from './helpers.js'
import { BentoCache } from '../packages/bentocache/src/bento_cache.js'
import { bentostore } from '../packages/bentocache/src/bento_store.js'
import { redisDriver } from '../packages/bentocache/src/drivers/redis.js'
import { memoryDriver } from '../packages/bentocache/src/drivers/memory.js'
import { REDIS_CREDENTIALS } from '../packages/bentocache/tests/helpers/index.js'

/**
 * Init providers
 */
const bentocache = new BentoCache({
  default: 'memory',
  stores: {
    memory: bentostore().useL1Layer(memoryDriver({ serialize: false })),
    redis: bentostore().useL2Layer(redisDriver({ connection: REDIS_CREDENTIALS })),
    tiered: bentostore()
      .useL1Layer(memoryDriver({ serialize: false }))
      .useL2Layer(redisDriver({ connection: REDIS_CREDENTIALS })),
  },
})

const bentocacheMemory = bentocache.use('memory')
const bentocacheRedis = bentocache.use('redis')
const bentocacheTiered = bentocache.use('tiered')

const cacheManagerMemory = createCache({
  stores: [new Keyv({ store: new CacheableMemory() })],
})

const cacheManagerRedis = createCache({
  stores: [new Keyv({ store: new KeyvRedis('redis://localhost:6379') })],
})

const cacheManagerTiered = createCache({
  stores: [
    new Keyv({ store: new CacheableMemory() }),
    new Keyv({ store: new KeyvRedis('redis://localhost:6379') }),
  ],
})

/**
 * Benchmark
 */
const bench = new Bench()
await bench
  .add('L1 GetOrSet - BentoCache', () => {
    return bentocacheMemory.getOrSet({
      key: 'bento:key',
      factory: () => getFromDb(),
      ttl: 100,
    })
  })
  .add('L1 GetOrSet - CacheManager', async () => {
    const result = await cacheManagerMemory.get('cm:key')
    if (result === null) {
      await cacheManagerMemory.set('cm:key', await getFromDb(), 100)
    }

    return result ?? 'value'
  })
  .add('L2 GetOrSet - BentoCache', () => {
    return bentocacheRedis.getOrSet({
      key: 'bento:key',
      factory: () => getFromDb(),
      ttl: 100,
    })
  })
  .add('L2 GetOrSet - CacheManager', async () => {
    const result = await cacheManagerRedis.get('cm:key')
    if (result === null) {
      await cacheManagerRedis.set('cm:key', await getFromDb(), 100)
    }

    return result ?? 'value'
  })
  .add('Tiered GetOrSet - BentoCache', () => {
    return bentocacheTiered.getOrSet({
      key: 'bento:key',
      factory: () => getFromDb(),
      ttl: 100,
    })
  })
  .add('Tiered GetOrSet - CacheManager', async () => {
    const result = await cacheManagerTiered.get('cm:key')
    if (result === null) {
      await cacheManagerTiered.set('cm:key', await getFromDb(), 100)
    }

    return result ?? 'value'
  })
  .add('Tiered Get - BentoCache', async () => {
    const result = bentocacheTiered.get({ key: 'bento:foo' })
    if (!result) await bentocacheTiered.set({ key: 'bento:foo', value: 'value', ttl: '10s' })
  })
  .add('Tiered Get - CacheManager', async () => {
    const result = cacheManagerTiered.get('cm:barbar')
    if (!result) await cacheManagerTiered.set('cm:barbar', 'value', 10_000)
  })
  .add('Tiered Set - BentoCache', async () => {
    await bentocacheTiered.set({ key: 'key', value: 10 })
  })
  .add('Tiered Set - CacheManager', async () => {
    await cacheManagerTiered.set('key', 10)
  })
  .run()

console.table(bench.table())

await Promise.all([
  bentocache.disconnectAll(),
  cacheManagerMemory.disconnect(),
  cacheManagerRedis.disconnect(),
  cacheManagerTiered.disconnect(),
])
