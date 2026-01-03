---
summary: The events emitted by Bentocache throughout its execution
---

# Events

Throughout its execution, Bentocache emits different events that can be listened to and received on your end. This allows you to do a lot of things, but mainly for monitoring purposes. Imagine a small Grafana dashboard backed by Prometheus that allows you to see the real-time status and behavior of your cache. Wouldn't that be nice?

## Listening to Events

You simply need to use the `on` method of the Bentocache instance to listen to events.

```ts
bento.on('cache:hit', ({ key, value, store }) => {
  console.log(`cache:hit: ${key}, value ${value}, store ${store}`)
})
```

There is also the `once` method that allows you to listen to an event only once.

```ts
bento.once('cache:hit', ({ key, value, store }) => {
  console.log(`cache:hit: ${key}, value ${value}, store ${store}`)
})
```

And finally, the `off` method that allows you to remove a listener.

```ts
const listener = ({ key, value, store }) => {
  console.log(`cache:hit: ${key}, value ${value}, store ${store}`)
}

bento.on('cache:hit', listener)
bento.off('cache:hit', listener)
```

## Using Your Own Emitter

If you already have an event emitter in your application, you can pass it to Bentocache so that it uses it instead of its own emitter.

```ts
const emitter = new EventEmitter()
const bento = new BentoCache({
  // highlight-start
  emitter,
  // highlight-end
  default: 'memory',
  stores: {
    memory: bentostore().useL1Layer(memoryDriver()),
  },
})
```

You can also use an emitter that is not an EventEmitter, as long as it implements the `Emitter` interface:

```ts
export interface Emitter {
  on: (event: string, cb: (...values: any[]) => void) => void
  once: (event: string, cb: (...values: any[]) => void) => void
  off: (event: string, cb: (...values: any[]) => void) => void
  emit: (event: string, ...values: any[]) => void
}
```

[Emittery](https://github.com/sindresorhus/emittery) is notably a good alternative to Node.js's `EventEmitter` that is compatible with this interface.

## List of Events

### `cache:hit`

Emitted when a key is found in the cache.

Payload: `{ key, value, store, graced }`

- `key`: The key that was found in the cache
- `value`: The value that was found in the cache
- `store`: The name of the store that was used to retrieve the value
- `graced`: `true` when the value was retrieved from a grace period

---

### `cache:miss`

Emitted when a key is not found in the cache.

Payload: `{ key, store }`

- `key`: The key that was not found in the cache
- `store`: The name of the store that was used to retrieve the value

---

### `cache:written`

Emitted when a key is written to the cache.

Payload: `{ key, value, store }`

- `key`: The key that was written to the cache
- `value`: The value that was written to the cache

---

### `cache:deleted`

Emitted when the key is removed from the cache.

Payload: `{ key, store }`

- `key`: The key that was removed from the cache
- `store`: The name of the store that was used to remove the value

---

### `cache:cleared`

Emitted when the cache is emptied.

Payload: `{ store }`

- `store`: The name of the store that was emptied

---

### `bus:message:published`

Emitted when the bus publishes a message to other applications.

Payload: `{ message }`

- `message`: The message that was published

---

### `bus:message:received`

Emitted when the application receives a message instructing it to update its cache.

Payload: `{ message }`

- `message`: The message that was received

---

## Tracing Channels (Experimental)

:::warning
This API is experimental and may change in future versions.
:::

Bentocache also exposes [Node.js Diagnostic Channels](https://nodejs.org/api/diagnostics_channel.html#tracingchannel) for more advanced instrumentation needs. Unlike events, tracing channels provide timing information and are designed for APM tools and OpenTelemetry integration.

### Why Tracing Channels?

- **Built-in**: No external dependencies, uses Node.js native `diagnostics_channel`
- **Zero overhead**: When no subscribers are attached, there's virtually no performance impact
- **Timing information**: Automatically tracks start/end of async operations
- **APM integration**: Works seamlessly with OpenTelemetry and other APM tools

### Available Channels

#### `bentocache.cache.operation`

Traces all cache operations with timing information.

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

### Message Properties

| Property    | Type                                                                | Description                                           |
| ----------- | ------------------------------------------------------------------- | ----------------------------------------------------- |
| `operation` | `'get' \| 'set' \| 'delete' \| 'deleteMany' \| 'clear' \| 'expire'` | The operation type                                    |
| `key`       | `string`                                                            | Cache key with full prefix (e.g., `'users:123'`)      |
| `keys`      | `string[]`                                                          | Multiple keys for `deleteMany` operation              |
| `store`     | `string`                                                            | Store name                                            |
| `hit`       | `boolean`                                                           | Whether the key was found (only for `get`)            |
| `tier`      | `'l1' \| 'l2'`                                                      | Which tier served the value (only for `get` hits)     |
| `graced`    | `boolean`                                                           | Whether value came from grace period (only for `get`) |

### OpenTelemetry Integration Example

```ts
import { tracingChannels, type CacheOperationMessage } from 'bentocache'
import { trace } from '@opentelemetry/api'

const tracer = trace.getTracer('bentocache')
const spans = new WeakMap()

tracingChannels.cacheOperation.subscribe({
  start(message: CacheOperationMessage) {
    const span = tracer.startSpan(`cache.${message.operation}`)
    span.setAttribute('cache.key', message.key ?? '')
    span.setAttribute('cache.store', message.store)
    spans.set(message, span)
  },
  asyncEnd(message: CacheOperationMessage) {
    const span = spans.get(message)
    if (!span) return

    if (message.hit !== undefined) {
      span.setAttribute('cache.hit', message.hit)
    }
    if (message.tier) {
      span.setAttribute('cache.tier', message.tier)
    }
    if (message.graced) {
      span.setAttribute('cache.graced', message.graced)
    }

    span.end()
  },
  error({ error, ...message }) {
    const span = spans.get(message)
    if (!span) return

    span.recordException(error)
    span.end()
  },
})
```
