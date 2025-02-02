/**
 * Benchmark a single set operation on a redis store
 */
import 'dotenv/config'

import Keyv from 'keyv'
import { Bench } from 'tinybench'
import KeyvRedis from '@keyv/redis'
import { createCache } from 'cache-manager'

import { BentoCache } from '../index.js'
import { bentostore } from '../src/bento_store.js'
import { redisDriver } from '../src/drivers/redis.js'
import { REDIS_CREDENTIALS } from '../tests/helpers/index.js'

const bench = new Bench()

const bentocache = new BentoCache({
  default: 'redis',
  stores: {
    redis: bentostore().useL2Layer(redisDriver({ connection: REDIS_CREDENTIALS })),
  },
})

const keyv = new Keyv(new KeyvRedis('redis://localhost:6379'))
const cacheManager = await createCache({
  stores: [new Keyv(new KeyvRedis('redis://localhost:6379'))],
})

await keyv.set('key', 'value')
await bentocache.set({ key: 'key', value: 'value' })
await cacheManager.set('key', 'value')

bench
  .add('BentoCache', async () => {
    await bentocache.set({ key: 'key', value: 'foo' })
  })
  .add('Keyv', async () => {
    await keyv.set('key', 'foo')
  })
  .add('CacheManager', async () => {
    await cacheManager.set('key', 'foo')
  })

await bench.run()
console.table(bench.table())

await Promise.all([bentocache.disconnect(), cacheManager.disconnect(), keyv.disconnect()])
