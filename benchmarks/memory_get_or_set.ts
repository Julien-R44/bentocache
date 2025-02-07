import 'dotenv/config'

import { Bench } from 'tinybench'

import { createProviders, getFromDb } from './helpers.js'

const { bentocache, cacheManager } = createProviders({
  withMemory: true,
  withRedis: false,
  serializeL1: false,
})

const bench = new Bench()
await bench
  .add('BentoCache', () => {
    return bentocache.getOrSet({
      key: 'bento:key',
      factory: () => getFromDb(),
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
  .run()

console.table(bench.table())

await Promise.all([bentocache.disconnect(), cacheManager.disconnect()])
