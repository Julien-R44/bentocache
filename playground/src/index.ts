import { BentoCache, bentostore } from 'bentocache'
import { redisDriver } from 'bentocache/drivers/redis'
import { memoryDriver } from 'bentocache/drivers/memory'

const bento = new BentoCache({
  default: 'multitier',
  stores: {
    myCache: bentostore().useL1Layer(memoryDriver({ maxSize: 10_000 })),

    multitier: bentostore()
      .useL1Layer(memoryDriver({ maxSize: 10_000 }))
      .useL2Layer(redisDriver({ connection: { host: '127.0.0.1', port: 6379 } })),
  },
})

const result = await bento.get('foo')
console.log(result)

bento.disconnectAll()
