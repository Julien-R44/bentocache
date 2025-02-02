/**
 * Benchmark a single get operation on a tiered store ( memory + redis )
 */
import 'dotenv/config'

import Keyv from 'keyv'
import { Bench } from 'tinybench'
import KeyvRedis from '@keyv/redis'
import { createCache } from 'cache-manager'
import { CacheableMemory } from 'cacheable'
import { setTimeout } from 'node:timers/promises'

import { BentoCache } from '../index.js'
import { bentostore } from '../src/bento_store.js'
import { redisDriver } from '../src/drivers/redis.js'
import { memoryDriver } from '../src/drivers/memory.js'
import { REDIS_CREDENTIALS } from '../tests/helpers/index.js'

const bench = new Bench({})

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

const getFromDb = async () => {
  await setTimeout(400)
  return 'value'
}

bench
  .add('BentoCache', async () => {
    return await bento.getOrSet({
      key: 'bento:key',
      factory: getFromDb,
      ttl: 100,
    })
  })
  .add('CacheManager', async () => {
    const result = await cacheManager.get('cm:key')
    if (result === null) {
      await cacheManager.set('cm:key', await getFromDb(), 100)
    }

    return result ?? 'value'
  })

await bench.run()
console.table(bench.table())

await Promise.all([bentocache.disconnectAll(), cacheManager.disconnect()])
