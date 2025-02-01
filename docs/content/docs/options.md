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
    })
  }
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

Default: `false`

Levels: `global`, `store`, `operation`

If `false`, then errors thrown by your L2 cache will be rethrown, and you will have to handle them yourself. Otherwise, they will just be ignored.

Note that in some cases, like when you use [Grace Periods](./grace_periods.md), errors will not be thrown, even if this option is set to `false`. Since this is the whole point of grace periods.

### `grace`

Default `undefined`

Levels: `global`, `store`, `operation`

A duration to define the [grace period](./grace_periods.md).

### `graceBackoff`

Default: `undefined`

Levels: `global`, `store`, `operation`

A duration to define the [grace backoff](./grace_periods.md).

### `timeout`

Default: `undefined`
Levels: `global`, `store`, `operation`

A duration to define a soft [timeout](./timeouts.md#soft-timeouts).

### `hardTimeout`

Default: `undefined`
Levels: `global`, `store`, `operation`

A duration to define a hard [timeout](./timeouts.md#hard-timeouts).

### `lockTimeout`

Default: `undefined`

Levels: `global`, `store`, `operation`

The maximum amount of time (in milliseconds) that the in-memory lock for [stampeded protection](./stampede_protection.md) can be held. If the lock is not released before this timeout, it will be released automatically. 

This is usually not needed, but can provide an extra layer of protection against theoretical deadlocks.

### `serializer`

Default: `JSON.stringify` and `JSON.parse`

A custom serializer to use when storing and retrieving values from the cache. For example, you could use [`superjson`](https://github.com/flightcontrolhq/superjson) to serialize and deserialize your values instead of `JSON.stringify` and `JSON.parse`.

```ts
import superjson from 'superjson'

const bento = new BentoCache({
  serializer: {
    serialize: superjson.stringify,
    deserialize: superjson.parse
  }
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
