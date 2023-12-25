/**
 * Benchmark a single get operation on a tiered store ( memory + redis )
 */
import 'dotenv/config'

import Keyv from 'keyv'
import { Redis } from 'ioredis'
import { Bench } from 'tinybench'
import KeyvTiered from '@keyv/tiered'
import { multiCaching, caching } from 'cache-manager'
import { redisStore } from 'cache-manager-ioredis-yet'

import { BentoCache } from '../index.js'
import { redisDriver } from '../drivers/redis.js'
import { bentostore } from '../src/bento_store.js'
import { memoryDriver } from '../drivers/memory.js'
import { REDIS_CREDENTIALS } from '../test_helpers/index.js'

const bench = new Bench()

const bentocache = new BentoCache({
  default: 'tiered',
  stores: {
    redis: bentostore().useL2Layer(redisDriver({ connection: REDIS_CREDENTIALS })),
    tiered: bentostore()
      .useL1Layer(memoryDriver({}))
      .useL2Layer(redisDriver({ connection: REDIS_CREDENTIALS })),
  },
})

const bentocacheTiered = bentocache.use('tiered')
const keyvRedis = new Keyv('redis://localhost:6379')
const keyv = new KeyvTiered({ remote: keyvRedis as any, local: new Keyv() })

const cacheManagerMemory = await caching('memory')
const cacheManagerRedis = await caching(await redisStore({ host: 'localhost', port: 6379 }))
const multiCache = multiCaching([cacheManagerMemory, cacheManagerRedis])

await keyv.set('key', 'value')
await bentocacheTiered.set('key', 'value')
await multiCache.set('key', 'value')

const ioredis = new Redis()

/**
 * Simple get benchmark
 */
bench
  .add('BentoCache', async () => {
    await bentocacheTiered.get('key')
  })
  .add('Keyv', async () => {
    await keyv.get('key')
  })
  .add('CacheManager', async () => {
    await multiCache.get('key')
  })

await bench.run()
console.table(bench.table())

await Promise.all([
  bentocache.disconnectAll(),
  ioredis.quit(),
  cacheManagerRedis.store.client.disconnect(),
  keyvRedis.disconnect(),
])
