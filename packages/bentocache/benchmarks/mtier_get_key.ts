/**
 * Benchmark a single get operation on a tiered store ( memory + redis )
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
    new Keyv({ store: new CacheableMemory() }),
    new Keyv({ store: new KeyvRedis('redis://localhost:6379') }),
  ],
})

await bento.set({ key: 'bento:key', value: 'value', ttl: '10s' })
await cacheManager.set('cm:key', 'value', 10_000)

bench
  .add('BentoCache', async () => {
    await bento.get({ key: 'bento:key' })
  })
  .add('CacheManager', async () => {
    await cacheManager.get('cm:key')
  })

await bench.run()
console.table(bench.table())

await Promise.all([bentocache.disconnectAll(), cacheManager.disconnect()])
