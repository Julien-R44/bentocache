---
summary: The list of options available to configure BentoCache
---

# Options

Here at the different possible options of BentoCache. Some of them are configurable, either **globally**, at the **store level** or at **operation level** ( when calling core methods like `getOrSet`, `get`, etc. ).

Order of precedence is as follows: **1. Operation level > 2. Store level > 3. Global level.**

```ts
// title: Options levels
const bento = new BentoCache({
  default: 'memory',

  // Global level 👇
  ttl: '1h',
  grace: '6h',

  stores: {
    memory: bentostore({
      // Store level 👇
      ttl: '30m',
      grace: false,
    }),
  },
})

bento.getOrSet({
  key: 'key',
  factory: () => fetchFromDb(),
  // Operation level 👇
  ttl: '1h',
  grace: '10h',
})
```

## TTL Formats

Quick note about TTLs and durations. Everywhere you are asked to provide a TTL or a duration, you can provide either:

- a `number` in milliseconds.
- a `string`, duration in human-readable format, see [lukeed/ms](https://github.com/lukeed/ms) for more details on the different formats accepted.
- In some cases : a `null` value. In the context of a TTL, this means that the item will never expire for example.

## List of options

### `prefix`

Default: `undefined`

Levels: `global`, `store`

This prefix will be added in front of all your cache keys. This can be useful, for example, in the case where you share a Redis with another application. Particularly when you need to call `.clear()`. Without a prefix, all keys will be deleted, even those not added by your application.

### `ttl`

Default: `30s`

Levels: `global`, `store`, `operation`

The TTL of the item to cache. See [TTL formats](#ttl-formats).

### `suppressL2Errors`

Default: `true` if L1 and L2 Caches are enabled. `false` if only L2 Cache is enabled.

Levels: `global`, `store`, `operation`

If `false`, then errors thrown by your L2 cache will be rethrown, and you will have to handle them yourself. Otherwise, they will just be ignored.

Note that in some cases, like when you use [Grace Periods](./grace_periods.md), errors will not be thrown, even if this option is set to `false`. Since this is the whole point of grace periods.

Note that event if errors are suppressed and not thrown, they will still be logged if you have a logger configured.

### `grace`

Default `false`

Levels: `global`, `store`, `operation`

A duration to define the [grace period](./grace_periods.md). Also can be `false` to disable grace periods.

### `graceBackoff`

Default: `10s`

Levels: `global`, `store`, `operation`

A duration to define the [grace backoff](./grace_periods.md).

### `timeout`

Default: `0`
Levels: `global`, `store`, `operation`

A duration to define a soft [timeout](./timeouts.md#soft-timeouts). By default, this is `0`, which means : if we have a stale value in cache, we will return it immediately, and start a background refresh.

### `hardTimeout`

Default: `undefined`
Levels: `global`, `store`, `operation`

A duration to define a hard [timeout](./timeouts.md#hard-timeouts).

### `forceFresh`

Default: `false`

Levels: `operation`

If `true`, the factory will be re-executed and its result will be cached, even if a valid value is already present in the cache.
However, if ever your factory is throwing an error, and a graced value is present in the cache, the graced value will be returned instead of the factory result.

### `lockTimeout`

Default: `undefined`

Levels: `global`, `store`, `operation`

The maximum amount of time (in milliseconds) that the in-memory lock for [stampeded protection](./stampede_protection.md) can be held. If the lock is not released before this timeout, it will be released automatically.

This is usually not needed, but can provide an extra layer of protection against theoretical deadlocks.

### `onFactoryError`

Default: `undefined`

A function that will be called when a factory, running in background or not, throws an error. This can be useful for logging or monitoring purposes.

```ts
const bento = new BentoCache({
  default: 'memory',
  onFactoryError: (error) => {
    console.error('Factory error', error, 'when trying to fetch for key', error.key)
    console.log(error.isBackground)
  }
  stores: {
    memory: bentostore().useL1Layer(memoryDriver({})),
  },
})
```

### `l2CircuitBreakerDuration`

Default: `undefined (disabled)`

Levels: `global`, `store`, `operation`

This option allows you to enable a simple circuit breaker system for the L2 Cache. If defined, the circuit breaker will open when a call to our distributed cache fails. It will stay open for `l2CircuitBreakerDuration` seconds.

If you're not familiar with the circuit breaker system, to summarize it very simply: if an operation on the L2 Cache fails and the circuit breaker option is activated, then all future operations on the L2 Cache will be rejected for `l2CircuitBreakerDuration` seconds, in order to avoid overloading the L2 Cache with operations that are likely to fail.

Once the `l2CircuitBreakerDuration` seconds have passed, the circuit breaker closes and operations on the L2 Cache can resume.

### skipL2Write

Default: `false`

Levels: `operation`

If `true`, the L2 Cache will not be called to write a value.

### skipBusNotify

Default: `false`

Levels: `operation`

If `true`, no notification will be sent to the bus after an operation.

### `serializer`

Default: `JSON.stringify` and `JSON.parse`

A custom serializer to use when storing and retrieving values from the cache. For example, you could use [`superjson`](https://github.com/flightcontrolhq/superjson) to serialize and deserialize your values instead of `JSON.stringify` and `JSON.parse`.

```ts
import superjson from 'superjson'

const bento = new BentoCache({
  serializer: {
    serialize: superjson.stringify,
    deserialize: superjson.parse,
  },
})
```

### `logger`

Default: `undefined`.

Levels: `global`

Only configurable at the BentoCache level.

See [logger](./digging_deeper/logging.md) for more details.

### `emitter`

Default: `new EventEmitter()`.

Levels: `global`

Only configurable at the BentoCache level.

See [events](./digging_deeper/events.md) for more details.

### `waitUntil`

Default: `undefined`.

Levels: `global`

Only configurable at the BentoCache level.

A function to register background tasks in serverless environments. This is essential for SWR (Stale-While-Revalidate) to work properly in serverless platforms like Vercel, Cloudflare Workers, Netlify, etc.

When BentoCache uses background revalidation (when a stale value is returned and the cache is refreshed in the background), it needs to inform the serverless platform that work is still ongoing after the response is sent. Without this, the serverless function may be terminated before the background task completes.

```ts
// title: Vercel Functions
import { waitUntil } from '@vercel/functions'

const bento = new BentoCache({
  default: 'memory',
  waitUntil: waitUntil,
  stores: {
    memory: bentostore().useL1Layer(memoryDriver({})),
  },
})
```

```ts
// title: Cloudflare Workers
import { waitUntil } from 'cloudflare:workers'

const bento = new BentoCache({
  default: 'memory',
  waitUntil: waitUntil,
  stores: {
    memory: bentostore().useL1Layer(memoryDriver({})),
  },
})
```

This option is only needed when:

- You're running in a serverless environment
- You're using features that trigger background revalidation (SWR with grace periods, soft timeouts, etc.)
