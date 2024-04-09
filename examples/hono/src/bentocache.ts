import { BentoCache, bentostore } from 'bentocache'
import { redisDriver } from 'bentocache/drivers/redis'
import { memoryDriver } from 'bentocache/drivers/memory'

export const bento = new BentoCache({
  default: 'memory',
  stores: {
    memory: bentostore().useL1Layer(memoryDriver({})),
    redis: bentostore().useL2Layer(redisDriver({ connection: { host: 'localhost', port: 6379 } })),
    memoryAndRedis: bentostore()
      .useL1Layer(memoryDriver({}))
      .useL2Layer(redisDriver({ connection: { host: 'localhost', port: 6379 } })),
  },
})
