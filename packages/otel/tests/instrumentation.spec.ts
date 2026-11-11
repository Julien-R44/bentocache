import { test } from '@japa/runner'
import { SpanStatusCode, trace } from '@opentelemetry/api'

import { createMemoryStore, setupInstrumentation } from './helpers.js'

test.group('BentoCacheInstrumentation', () => {
  test('records cache spans under the active parent span of a real tracer provider', async ({
    assert,
    cleanup,
  }) => {
    const { exporter, bentocacheModule } = await setupInstrumentation(cleanup, {}, 'modulePatch')
    const store = createMemoryStore(bentocacheModule)
    const tracer = trace.getTracer('test-app')

    await tracer.startActiveSpan('request', async requestSpan => {
      await store.getOrSet({ key: 'user:1', ttl: '10s', factory: async () => ({ id: 1 }) })
      await store.get({ key: 'user:1' })
      await store
        .getOrSet({
          key: 'user:2',
          ttl: '10s',
          factory: async () => {
            throw new Error('factory failed')
          },
        })
        .catch(() => {})
      requestSpan.end()
    })

    const spans = exporter.getFinishedSpans()
    const requestSpan = spans.find(span => span.name === 'request')!
    const traceId = requestSpan.spanContext().traceId
    const cacheSpans = spans.filter(span => span.name.startsWith('cache.'))

    assert.deepEqual(cacheSpans.map(span => span.name).sort(), [
      'cache.factory',
      'cache.factory',
      'cache.get',
      'cache.getOrSet',
      'cache.getOrSet',
      'cache.set',
    ])

    for (const span of cacheSpans) {
      assert.equal(span.spanContext().traceId, traceId)
      assert.equal(span.instrumentationScope.name, '@bentocache/otel')
    }

    const [okGetOrSet, failedGetOrSet] = cacheSpans.filter(span => span.name === 'cache.getOrSet')
    assert.equal(okGetOrSet.parentSpanContext?.spanId, requestSpan.spanContext().spanId)
    assert.equal(okGetOrSet.attributes['cache.store'], 'memory')
    assert.isUndefined(okGetOrSet.attributes['cache.key'])

    const getSpan = cacheSpans.find(span => span.name === 'cache.get')!
    assert.equal(getSpan.parentSpanContext?.spanId, requestSpan.spanContext().spanId)
    assert.strictEqual(getSpan.attributes['cache.hit'], true)

    assert.equal(failedGetOrSet.status.code, SpanStatusCode.ERROR)
    assert.equal(failedGetOrSet.status.message, 'Factory has thrown an error')
    assert.equal(failedGetOrSet.events[0]?.name, 'exception')
  })

  test('creates cache spans from diagnostic channel', async ({ assert, cleanup }) => {
    const { exporter, bentocacheModule } = await setupInstrumentation(
      cleanup,
      { includeKeys: true, requireParentSpan: false },
      'modulePatch',
    )
    const store = createMemoryStore(bentocacheModule)

    await store.set({ key: 'foo', value: 'bar' })
    await store.get({ key: 'foo' })

    const spans = exporter.getFinishedSpans()
    const spanNames = spans.map(span => span.name)

    assert.isTrue(spanNames.includes('cache.set'))
    assert.isTrue(spanNames.includes('cache.get'))

    const getSpan = spans.find(span => span.name === 'cache.get')
    assert.equal(getSpan?.attributes['cache.hit'], true)
    assert.equal(getSpan?.attributes['cache.tier'], 'l1')
    assert.equal(getSpan?.attributes['cache.key'], 'bentocache:foo')
  })

  test('does not create spans without parent span when requireParentSpan is true', async ({
    assert,
    cleanup,
  }) => {
    const { exporter, bentocacheModule } = await setupInstrumentation(
      cleanup,
      { requireParentSpan: true, includeKeys: true },
      'modulePatch',
    )
    const store = createMemoryStore(bentocacheModule)

    await store.set({ key: 'foo', value: 'bar' })
    await store.get({ key: 'foo' })

    assert.equal(exporter.getFinishedSpans().length, 0)
  })

  test('supports manual registration when module interception is unavailable', async ({
    assert,
    cleanup,
  }) => {
    const { exporter, bentocacheModule } = await setupInstrumentation(
      cleanup,
      { requireParentSpan: false },
      'manualRegister',
    )
    const store = createMemoryStore(bentocacheModule)

    await store.set({ key: 'foo', value: 'bar' })
    const span = exporter.getFinishedSpans().find(item => item.name === 'cache.set')

    assert.exists(span)
    assert.isUndefined(span?.attributes['cache.key'])
  })

  test('allows customizing span names with spanNamePrefix', async ({ assert, cleanup }) => {
    const prefixed = await setupInstrumentation(
      cleanup,
      { requireParentSpan: false, spanNamePrefix: 'bento' },
      'modulePatch',
    )
    const prefixedStore = createMemoryStore(prefixed.bentocacheModule)
    await prefixedStore.set({ key: 'foo', value: 'bar' })
    await prefixedStore.get({ key: 'foo' })

    const prefixedNames = prefixed.exporter.getFinishedSpans().map(span => span.name)
    assert.isTrue(prefixedNames.includes('bento.set'))
    assert.isTrue(prefixedNames.includes('bento.get'))
  })

  test('allows customizing span names with spanName factory', async ({ assert, cleanup }) => {
    const custom = await setupInstrumentation(
      cleanup,
      {
        requireParentSpan: false,
        spanName: message => `custom.${message.operation}`,
      },
      'modulePatch',
    )
    const customStore = createMemoryStore(custom.bentocacheModule)
    await customStore.set({ key: 'foo', value: 'bar' })
    await customStore.get({ key: 'foo' })

    const customNames = custom.exporter.getFinishedSpans().map(span => span.name)
    assert.isTrue(customNames.includes('custom.set'))
    assert.isTrue(customNames.includes('custom.get'))
  })

  test('concurrent getOrSet calls with the same key produce sibling spans, not nested', async ({
    assert,
    cleanup,
  }) => {
    const { exporter, bentocacheModule } = await setupInstrumentation(
      cleanup,
      { includeKeys: true, requireParentSpan: false },
      'modulePatch',
    )
    const store = createMemoryStore(bentocacheModule)

    await Promise.all([
      store.getOrSet({ key: 'same-key', ttl: '10s', factory: async () => 'a' }),
      store.getOrSet({ key: 'same-key', ttl: '10s', factory: async () => 'b' }),
      store.getOrSet({ key: 'same-key', ttl: '10s', factory: async () => 'c' }),
    ])

    const spans = exporter.getFinishedSpans()
    const getOrSetSpans = spans.filter(span => span.name === 'cache.getOrSet')

    assert.isTrue(getOrSetSpans.length >= 3)

    // None of the getOrSet spans should be parented to another getOrSet span
    const getOrSetSpanIds = new Set(getOrSetSpans.map(s => s.spanContext().spanId))
    for (const span of getOrSetSpans) {
      assert.isFalse(
        getOrSetSpanIds.has(span.parentSpanContext?.spanId ?? ''),
        `getOrSet span should not be a child of another getOrSet span`,
      )
    }
  })

  test('sanitizes keys and keeps getOrSet child spans parented to getOrSet span', async ({
    assert,
    cleanup,
  }) => {
    const { exporter, bentocacheModule } = await setupInstrumentation(
      cleanup,
      {
        includeKeys: true,
        requireParentSpan: false,
        keySanitizer: () => '[redacted]',
      },
      'modulePatch',
    )
    const store = createMemoryStore(bentocacheModule)

    await store.getOrSet({
      key: 'user-42',
      ttl: '10s',
      factory: async () => ({ id: 42 }),
    })

    const spans = exporter.getFinishedSpans()
    const getOrSetSpan = spans.find(span => span.name === 'cache.getOrSet')
    const factorySpan = spans.find(span => span.name === 'cache.factory')
    const setSpan = spans.find(span => span.name === 'cache.set')

    assert.exists(getOrSetSpan)
    assert.exists(factorySpan)
    assert.exists(setSpan)

    assert.equal(getOrSetSpan?.attributes['cache.key'], '[redacted]')
    assert.equal(factorySpan?.attributes['cache.key'], '[redacted]')
    assert.equal(setSpan?.attributes['cache.key'], '[redacted]')
    assert.equal(factorySpan?.parentSpanContext?.spanId, getOrSetSpan?.spanContext().spanId)
    assert.equal(setSpan?.parentSpanContext?.spanId, getOrSetSpan?.spanContext().spanId)
  })
})
