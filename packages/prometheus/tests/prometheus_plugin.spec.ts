import { test } from '@japa/runner'
import { sleep } from '@julr/utils/misc'
import { Registry, register } from 'prom-client'
import { BentoCache, bentostore } from 'bentocache'
import { memoryDriver } from 'bentocache/drivers/memory'

import { prometheusPlugin } from '../index.js'
import type { PrometheusPluginOptions } from '../src/types.js'

function createCache(promOptions?: PrometheusPluginOptions) {
  const registry = new Registry()
  const bento = new BentoCache({
    default: 'memory',
    stores: { memory: bentostore().useL1Layer(memoryDriver()) },
    plugins: [prometheusPlugin({ registry, ...promOptions })],
  })

  return { bento, registry }
}

test.group('Prometheus Plugin', () => {
  test('add metrics to specified registry', async ({ assert }) => {
    const { registry } = createCache()
    const result = await registry.getMetricsAsJSON()
    const busMessageReceived = result.find(
      (metric) => metric.name === 'bentocache_bus_messages_received',
    )

    assert.isDefined(busMessageReceived)
    assert.isEmpty(await register.getMetricsAsJSON())
  })

  test('register hit/miss/write/deletes events', async ({ assert }) => {
    const { bento, registry } = createCache()

    await bento.get({ key: 'foo' })
    await bento.set({ key: 'foo', value: 'bar' })
    await bento.get({ key: 'foo' })
    await bento.delete({ key: 'foo' })

    const hits = await registry.getSingleMetric('bentocache_hits')?.get()
    const misses = await registry.getSingleMetric('bentocache_misses')?.get()
    const writes = await registry.getSingleMetric('bentocache_writes')?.get()
    const deletes = await registry.getSingleMetric('bentocache_deletes')?.get()

    assert.deepEqual(hits?.values.at(0), {
      value: 1,
      labels: { store: 'memory', key: 'foo', layer: 'l1' },
    })
    assert.deepEqual(misses?.values.at(0), { value: 1, labels: { store: 'memory', key: 'foo' } })
    assert.deepEqual(writes?.values.at(0), { value: 1, labels: { store: 'memory', key: 'foo' } })
    assert.deepEqual(deletes?.values.at(0), { value: 1, labels: { store: 'memory', key: 'foo' } })
  })

  test('register graced hits', async ({ assert }) => {
    const { bento, registry } = createCache()

    await bento.set({ key: 'foo', value: 'bar', ttl: 1, grace: '2h' })

    await sleep(400)

    await bento.getOrSet({
      key: 'foo',
      factory: () => {
        throw new Error('Factory error')
      },
      grace: '2h',
    })

    const hits = await registry.getSingleMetric('bentocache_hits')?.get()
    const gracedHits = await registry.getSingleMetric('bentocache_graced_hits')?.get()
    const misses = await registry.getSingleMetric('bentocache_misses')?.get()

    assert.isUndefined(hits?.values.at(0))
    assert.isUndefined(misses?.values.at(0))
    assert.deepEqual(gracedHits?.values.at(0), {
      value: 1,
      labels: { store: 'memory', key: 'foo', layer: 'l1' },
    })
  })

  test('group keys', async ({ assert }) => {
    const { bento, registry } = createCache({
      keyGroups: [
        [/^users:(\d+)$/, `users:*`],
        [/^posts:(\d+)$/, 'posts:*'],
      ],
    })

    await bento.set({ key: 'posts:1', value: 'foo' })
    await bento.set({ key: 'posts:2', value: 'bar' })

    await bento.get({ key: 'users:1' })
    await bento.get({ key: 'users:2' })
    await bento.get({ key: 'posts:1' })
    await bento.get({ key: 'posts:2' })

    const hits = await registry.getSingleMetric('bentocache_hits')?.get()
    const misses = await registry.getSingleMetric('bentocache_misses')?.get()
    const writes = await registry.getSingleMetric('bentocache_writes')?.get()

    assert.deepEqual(misses?.values.at(0), {
      value: 2,
      labels: { store: 'memory', key: 'users:*' },
    })

    assert.deepEqual(hits?.values.at(0), {
      value: 2,
      labels: { store: 'memory', key: 'posts:*', layer: 'l1' },
    })

    assert.deepEqual(writes?.values.at(0), {
      value: 2,
      labels: { store: 'memory', key: 'posts:*' },
    })
  })
})
