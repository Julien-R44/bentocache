import { test } from '@japa/runner'

import { createMemoryStore, setupInstrumentation } from './helpers.js'

test.group('BentoCacheInstrumentation', () => {
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
    const spanNames = spans.map((span) => span.name)

    assert.isTrue(spanNames.includes('cache.set'))
    assert.isTrue(spanNames.includes('cache.get'))

    const getSpan = spans.find((span) => span.name === 'cache.get')
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
    const span = exporter.getFinishedSpans().find((item) => item.name === 'cache.set')

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

    const prefixedNames = prefixed.exporter.getFinishedSpans().map((span) => span.name)
    assert.isTrue(prefixedNames.includes('bento.set'))
    assert.isTrue(prefixedNames.includes('bento.get'))
  })

  test('allows customizing span names with spanName factory', async ({ assert, cleanup }) => {
    const custom = await setupInstrumentation(
      cleanup,
      {
        requireParentSpan: false,
        spanName: (message) => `custom.${message.operation}`,
      },
      'modulePatch',
    )
    const customStore = createMemoryStore(custom.bentocacheModule)
    await customStore.set({ key: 'foo', value: 'bar' })
    await customStore.get({ key: 'foo' })

    const customNames = custom.exporter.getFinishedSpans().map((span) => span.name)
    assert.isTrue(customNames.includes('custom.set'))
    assert.isTrue(customNames.includes('custom.get'))
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
    const getOrSetSpan = spans.find((span) => span.name === 'cache.getOrSet')
    const factorySpan = spans.find((span) => span.name === 'cache.factory')
    const setSpan = spans.find((span) => span.name === 'cache.set')

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
