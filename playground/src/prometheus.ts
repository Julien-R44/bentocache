/**
 * This playground file is used to seed data into Prometheus/Grafana
 * in order to test our Grafana dashboards
 */
import { Registry } from 'prom-client'
import { createServer } from 'node:http'
import { BentoCache, bentostore } from 'bentocache'
import { redisDriver } from 'bentocache/drivers/redis'
import { memoryDriver } from 'bentocache/drivers/memory'
import { prometheusPlugin } from '@bentocache/plugin-prometheus'

const registry = new Registry()

const bento = new BentoCache({
  default: 'multitier',
  plugins: [prometheusPlugin({ registry })],
  stores: {
    myCache: bentostore().useL1Layer(memoryDriver({ maxSize: 10_000 })),

    multitier: bentostore()
      .useL1Layer(memoryDriver({ maxSize: 10_000 }))
      .useL2Layer(redisDriver({ connection: { host: '127.0.0.1', port: 6379 } })),
  },
})

const server = createServer(async (_req, res) => {
  const metrics = await registry.metrics()
  res.writeHead(200, { 'Content-Type': registry.contentType })
  res.end(metrics)
})

server.listen(8080, () => {
  console.log('server listening on port 8080')
})

while (true) {
  const key = (Math.random() > 0.5 ? 'users' : 'posts') + ':' + Math.floor(Math.random() * 5)
  if (Math.random() > 0.8) {
    await bento.delete(key)
    continue
  }

  const result = await bento.getOrSet(key, async () => {
    return { hello: 'world' }
  })

  console.log('key', key, 'result', result)
  await new Promise((resolve) => setTimeout(resolve, Math.random() * 1000))
}
