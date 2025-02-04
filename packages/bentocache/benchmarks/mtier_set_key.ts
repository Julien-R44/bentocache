/**
 * Benchmark a single set operation on a tiered store ( memory + redis )
 */
import 'dotenv/config'

import Keyv from 'keyv'
import { Bench } from 'tinybench'
import KeyvRedis from '@keyv/redis'
import { createCache } from 'cache-manager'
import { CacheableMemory } from 'cacheable'

import { BentoCache } from '../index.js'
import { bentostore } from '../src/bento_store.js'
import { redisDriver } from '../src/drivers/redis.js'
import { memoryDriver } from '../src/drivers/memory.js'
import { REDIS_CREDENTIALS } from '../tests/helpers/index.js'

const bench = new Bench()

const bentocache = new BentoCache({
  default: 'tiered',
  stores: {
    tiered: bentostore()
      .useL1Layer(memoryDriver({}))
      .useL2Layer(redisDriver({ connection: REDIS_CREDENTIALS })),
  },
})

const bento = bentocache.use('tiered')

const cacheManager = createCache({
  stores: [
    new Keyv({
      store: new CacheableMemory({ ttl: 60_000, lruSize: 5000 }),
    }),

    new Keyv({
      store: new KeyvRedis('redis://localhost:6379'),
    }),
  ],
})

await bento.set({ key: 'key', value: 'value' })
await cacheManager.set('key', 'value')

bench
  .add('BentoCache', async () => {
    await bento.set({ key: 'key', value: 10 })
  })
  .add('CacheManager', async () => {
    await cacheManager.set('key', 10)
  })

await bench.run()
console.table(bench.table())

await Promise.all([bentocache.disconnectAll(), cacheManager.disconnect()])
