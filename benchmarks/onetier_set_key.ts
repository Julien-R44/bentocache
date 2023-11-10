/**
 * Benchmark a single set operation on a memory store
 */
import Keyv from 'keyv'
import { Bench } from 'tinybench'
import { caching } from 'cache-manager'

import 'dotenv/config'
import { BentoCache } from '../index.js'
import { bentostore } from '../src/bento_store.js'
import { memoryDriver } from '../drivers/memory.js'

const bench = new Bench()

const bentocache = new BentoCache({
  default: 'memory',
  stores: { memory: bentostore().useL1Layer(memoryDriver()) },
}).use('memory')

const keyv = new Keyv()
const cacheManager = await caching('memory')

await keyv.set('key', 'value')
await bentocache.set('key', 'value')
await cacheManager.set('key', 'value')

bench
  .add('BentoCache', async () => {
    await bentocache.get('key')
  })
  .add('Keyv', async () => {
    await keyv.get('key')
  })
  .add('CacheManager', async () => {
    await cacheManager.get('key')
  })

await bench.run()
console.table(bench.table())
