import Keyv from 'keyv'
import KeyvRedis from '@keyv/redis'
import { createCache } from 'cache-manager'
import { CacheableMemory } from 'cacheable'
import { setTimeout } from 'node:timers/promises'

import { BentoCache } from '../packages/bentocache/src/bento_cache.js'
import { bentostore } from '../packages/bentocache/src/bento_store.js'
import { redisDriver } from '../packages/bentocache/src/drivers/redis.js'
import { memoryDriver } from '../packages/bentocache/src/drivers/memory.js'

export const REDIS_CREDENTIALS = {
  host: process.env.REDIS_HOST!,
  port: Number(process.env.REDIS_PORT),
}

export function createProviders(options: {
  withMemory: boolean
  withRedis: boolean
  serializeL1: boolean
}): any {
  const store = bentostore()
  if (options.withMemory) {
    store.useL1Layer(memoryDriver({ serialize: options.serializeL1 }))
  }
  if (options.withRedis) {
    store.useL2Layer(redisDriver({ connection: REDIS_CREDENTIALS }))
  }

  const bentocache = new BentoCache({
    default: 'cache',
    stores: { cache: store },
  })

  const cacheManager = createCache({
    stores: [
      options.withMemory ? new Keyv({ store: new CacheableMemory() }) : null,
      options.withRedis ? new Keyv({ store: new KeyvRedis('redis://localhost:6379') }) : null,
    ].filter(Boolean) as any[],
  })

  return {
    bentocache: bentocache.use('cache'),
    cacheManager,
  }
}

const data = Array.from({ length: 100 }, (_, i) => i).map((i) => ({
  foo: 'bar',
  date: new Date(),
  number: i,
  set: new Set([1, 2, 3]),
}))

export async function getFromDb(delay = 400) {
  await setTimeout(delay)
  return data
}
