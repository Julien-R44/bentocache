---
summary: Instrument Bentocache with OpenTelemetry using @bentocache/otel
---

# Telemetry (OpenTelemetry)

:::warning
This package is experimental and may change in future versions.
:::

Bentocache provides an official OpenTelemetry instrumentation package: `@bentocache/otel`.


It listens to Bentocache tracing channels and emits spans like:

- `cache.get`
- `cache.getOrSet`
- `cache.set`
- `cache.delete`
- `cache.deleteMany`
- `cache.clear`
- `cache.expire`
- `cache.factory`

## Tracing Channels

Bentocache exposes [Node.js Diagnostic Channels](https://nodejs.org/api/diagnostics_channel.html#tracingchannel) for advanced instrumentation and APM integration, which `@bentocache/otel` utilizes for OpenTelemetry spans. You can also subscribe to these channels directly for custom telemetry or monitoring solutions.

### Available channels

#### `bentocache.cache.operation`

Traces cache operations with timing information.

```ts
import { tracingChannels } from 'bentocache'

tracingChannels.cacheOperation.subscribe({
  start(message) {
    // Called when operation starts
    console.log(`Starting ${message.operation} on ${message.key}`)
  },
  asyncEnd(message) {
    // Called when async operation completes
    console.log(`Completed ${message.operation}`, {
      key: message.key,
      store: message.store,
      hit: message.hit,
      tier: message.tier,
      graced: message.graced,
    })
  },
  error({ error, ...message }) {
    // Called when operation fails
    console.error(`Failed ${message.operation}:`, error)
  },
})
```

### Message properties

| Property    | Type                                                                | Description                                           |
| ----------- | ------------------------------------------------------------------- | ----------------------------------------------------- |
| `operation` | `'get' \| 'set' \| 'delete' \| 'deleteMany' \| 'clear' \| 'expire'` | The operation type                                    |
| `key`       | `string`                                                            | Cache key with full prefix (e.g., `'users:123'`)      |
| `keys`      | `string[]`                                                          | Multiple keys for `deleteMany` operation              |
| `store`     | `string`                                                            | Store name                                            |
| `hit`       | `boolean`                                                           | Whether the key was found (only for `get`)            |
| `tier`      | `'l1' \| 'l2'`                                                      | Which tier served the value (only for `get` hits)     |
| `graced`    | `boolean`                                                           | Whether value came from grace period (only for `get`) |

## Install

:::codegroup
```sh
// title: npm
npm i @bentocache/otel
```

```sh
// title: pnpm
pnpm add @bentocache/otel
```

```sh
// title: yarn
yarn add @bentocache/otel
```
:::

## Basic setup

```ts
import { NodeSDK } from '@opentelemetry/sdk-node'
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http'
import { BentoCacheInstrumentation } from '@bentocache/otel'

const traceExporter = new OTLPTraceExporter({
  url: 'http://localhost:4318/v1/traces',
})

const sdk = new NodeSDK({
  serviceName: 'my-app',
  traceExporter,
  instrumentations: [
    new BentoCacheInstrumentation({
      requireParentSpan: true,
      includeKeys: false,
      suppressInternalOperations: true,
    }),
  ],
})

sdk.start()
```

## Parent spans and `requireParentSpan`

By default, `requireParentSpan` is `true`.
This means Bentocache spans are created only when a parent span is active.

If you do not use HTTP/framework instrumentation yet, you can:

- Set `requireParentSpan: false`, or
- Create parent spans manually around your application logic.

```ts
import { trace } from '@opentelemetry/api'

const tracer = trace.getTracer('app')

await tracer.startActiveSpan('request', async (span) => {
  await bento.getOrSet({
    key: 'user:1',
    ttl: '5m',
    factory: () => fetchUser(),
  })

  span.end()
})
```

## Span naming and attributes

Default span names use `cache.<operation>`.
You can customize naming with `spanName` or `spanNamePrefix`.

Common attributes:

- `cache.operation`
- `cache.store`
- `cache.key`
- `cache.keys`
- `cache.hit`
- `cache.tier`
- `cache.graced`

## Configuration options

- `requireParentSpan` (default: `true`): Create spans only when a parent span exists.
- `includeKeys` (default: `false`): Include key/keys attributes on spans.
- `keySanitizer`: Sanitize keys before adding them to span attributes.
- `spanName`: Provide a custom span-name factory.
- `spanNamePrefix` (default: `cache`): Prefix for default span names.
- `suppressInternalOperations` (default: `true`): Suppress internal L2/bus operations.
