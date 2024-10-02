import { createServer } from 'node:http'
import { setTimeout } from 'node:timers/promises'
import { BentoCache, bentostore } from 'bentocache'
import { redisDriver } from 'bentocache/drivers/redis'

const bento = new BentoCache({
  default: 'redis',
  stores: {
    redis: bentostore().useL2Layer(redisDriver({ connection: { host: '127.0.0.1', port: 6379 } })),
  },
})

function getCachedValue() {
  return bento.getOrSet({
    key: 'foo',
    factory: async () => {
      await setTimeout(1000)
      return 'bar'
    },
    ttl: '4s',
  })
}

const server = createServer(async (_req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' })

  const value = await getCachedValue()
  res.end(JSON.stringify(value))
})

server.listen(8042, () => {
  console.log('Listening on http://localhost:8042')
})
