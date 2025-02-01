import { test } from '@japa/runner'
import { Registry, register } from 'prom-client'
import { setTimeout } from 'node:timers/promises'
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

    await bento.get('foo')
    await bento.set('foo', 'bar')
    await bento.get('foo')
    await bento.delete('foo')

    const hits = await registry.getSingleMetric('bentocache_hits')?.get()
    const misses = await registry.getSingleMetric('bentocache_misses')?.get()
    const writes = await registry.getSingleMetric('bentocache_writes')?.get()
    const deletes = await registry.getSingleMetric('bentocache_deletes')?.get()

    assert.deepEqual(hits?.values.at(0), { value: 1, labels: { store: 'memory', key: 'foo' } })
    assert.deepEqual(misses?.values.at(0), { value: 1, labels: { store: 'memory', key: 'foo' } })
    assert.deepEqual(writes?.values.at(0), { value: 1, labels: { store: 'memory', key: 'foo' } })
    assert.deepEqual(deletes?.values.at(0), { value: 1, labels: { store: 'memory', key: 'foo' } })
  })

  test('register graced hits', async ({ assert }) => {
    const { bento, registry } = createCache()

    await bento.set('foo', 'bar', { ttl: 1, grace: '2' })

    await setTimeout(400)

    await bento.getOrSet(
      'foo',
      () => {
        throw new Error('Factory error')
      },
      { grace: '2h' },
    )

    const hits = await registry.getSingleMetric('bentocache_hits')?.get()
    const gracedHits = await registry.getSingleMetric('bentocache_graced_hits')?.get()
    const misses = await registry.getSingleMetric('bentocache_misses')?.get()

    assert.isUndefined(hits?.values.at(0))
    assert.isUndefined(misses?.values.at(0))
    assert.deepEqual(gracedHits?.values.at(0), {
      value: 1,
      labels: { store: 'memory', key: 'foo' },
    })
  })

  test('group keys', async ({ assert }) => {
    const { bento, registry } = createCache({
      keyGroups: [
        [/^users:(\d+)$/, `users:*`],
        [/^posts:(\d+)$/, 'posts:*'],
      ],
    })

    await bento.set('posts:1', 'foo')
    await bento.set('posts:2', 'bar')

    await bento.get('users:1')
    await bento.get('users:2')
    await bento.get('posts:1')
    await bento.get('posts:2')

    const hits = await registry.getSingleMetric('bentocache_hits')?.get()
    const misses = await registry.getSingleMetric('bentocache_misses')?.get()
    const writes = await registry.getSingleMetric('bentocache_writes')?.get()

    assert.deepEqual(misses?.values.at(0), {
      value: 2,
      labels: { store: 'memory', key: 'users:*' },
    })

    assert.deepEqual(hits?.values.at(0), {
      value: 2,
      labels: { store: 'memory', key: 'posts:*' },
    })

    assert.deepEqual(writes?.values.at(0), {
      value: 2,
      labels: { store: 'memory', key: 'posts:*' },
    })
  })
})
