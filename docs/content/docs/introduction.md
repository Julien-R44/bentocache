---
summary: Bentocache is a robust multi-tier caching library for Node.js applications
---

# Introduction

![](https://static.julr.dev/bentocache.png)

Bentocache is a robust multi-tier caching library for Node.js applications

- 🗄️ Multi-tier caching
- 🔄 Synchronization of local cache via Bus
- 🚀 Many drivers (Redis, Upstash, In-memory, Postgres, Sqlite and others)
- 🛡️ Grace period and timeouts. Serve stale data when the store is dead or slow
- 🤓 SWR-like caching strategy
- 🗂️ Namespaces. Group your keys by categories.
- 🏷️ Tagging. Easy invalidations.
- 🛑 Cache stamped protection.
- 🏷️ Named caches
- 📖 Well documented + handy JSDoc annotations
- 📊 Events. Useful for monitoring and metrics
- 📝 Easy Prometheus integration and ready-to-use Grafana dashboard
- 🧩 Easily extendable with your own driver

## Why Bentocache ?

There are already caching libraries for Node: [`keyv`](https://keyv.org/), [`cache-manager`](https://github.com/node-cache-manager/node-cache-manager#readme), or [`unstorage`](https://unstorage.unjs.io/). However, I think that we could rather consider these libraries as bridges that allow different stores to be used via a unified API, rather than true caching solutions as such.

Not to knock them, on the contrary, they have their use cases and cool. Some are even "marketed" as such and are still very handy for simple caching system.

Bentocache, on the other hand, is a **full-featured caching library**. We indeed have this notion of unified access to different drivers, but in addition to that, we have a ton of features that will allow you to do robust caching.

## Quick presentation

Bentocache is a caching solution aimed at combining performance and flexibility. If you are looking for a caching system that can transition from basic use to advanced multi-level configuration, you are in the right place. Here's what you need to know :

### One-level

The one-level mode is a standard caching method. Choose from a variety of drivers such as **Redis**, **In-Memory**, **Filesystem**, **DynamoDB**, and more, and you're ready to go.

In addition to this, you benefit from many features that allow you to efficiently manage your cache, such as **cache stampede protection**, **grace periods**, **timeouts**, **namespaces**, etc.

### Two-levels
For those looking to go further, you can use the two-levels caching system. Here's basically how it works:

- **L1: Local Cache**: First level cache. Data is stored in memory with an LRU algorithm for quick access
- **L2: Distributed Cache**: If the data is not in the in-memory cache, it is searched in the distributed cache (Redis, for example)
- **Synchronization via Bus**: In a multi-instance context, you can synchronize different local in-memory caches of your instances via a Bus like Redis or RabbitMQ. This method maintains cache integrity across multiple instances

Here is a simplified diagram of the flow :

![Bentocache Diagram flow](content/docs/bentocache_flow.webp)

All of this is managed invisibly for you via Bentocache. The only thing to do is to set up a bus in your infrastructure. But if you need multi-level cache, you're probably already using Redis rather than your database as a distributed cache. So you can leverage it to synchronize your local caches

The major benefit of multi-tier caching is that it allows for responses between 2,000x and 5,000x faster. While Redis is fast, accessing RAM is REALLY MUCH faster.

In fact, it's a quite common pattern : to quote an example, it's [what Stackoverflow does](https://nickcraver.com/blog/2019/08/06/stack-overflow-how-we-do-app-caching/#layers-of-cache-at-stack-overflow).


To give some perspective, here's a simple benchmark that shows the difference between a simple distributed cache ( using Redis ) vs a multi-tier cache ( using Redis + In-memory cache ) :

```ts
// title: Benchmarked code
benchmark
  .add('BentoCache', async () => await bento.get('key'))
  .add('ioredis', async () => await ioredis.get('key'))
```

![Redis vs Multi-tier caching](content/docs/redis_vs_mtier.webp)

So a pretty huge difference.


## Features

Below is a list of the main features of BentoCache. If you want to know more, you can read each associated documentation page.

### Multi layer caching

Multi-layer caching allows you to combine the speed of in-memory caching with the persistence of a distributed cache. Best of both worlds.

### Lot of drivers

Many drivers available to suit all situations: Redis, Upstash, Database (MySQL, SQLite, PostgreSQL), DynamoDB, Filesystem, In-memory (LRU Cache), Vercel KV...

See the [drivers documentation](./cache_drivers.md) for list of available drivers. Also, very easy to extend the library and [add your own driver](./extend/custom_cache_driver.md)

<!-- :::warning
Only a Redis driver for the bus is currently available. We probably have drivers for other backends like Zookeeper, Kafka, RabbitMQ... Let us know with an issue if you are interested in this.
::: -->


### Resiliency

- [Grace period](./grace_periods.md): Keep your application running smoothly with the ability to temporarily use expired cache entries when your database is down, or when a factory is failing.

- [Cache stamped prevention](./stampede_protection.md): Ensuring that only one factory is executed at the same time.

- [Retry queue](./multi_tier.md#retry-queue-strategy) : When an application fails to publish something to the bus, it is added to a queue and retried later.

### Timeouts

If your factory is taking too long to execute, you can just return a little bit of stale data while keeping the factory running in the background. Next time the entry is requested, it will be already computed and served immediately.

### Tagging

Allows associating a cache entry with one or more tags to simplify invalidation. Instead of managing individual keys, entries can be grouped under multiple tags and invalidated in a single operation.

```ts
await bento.getOrSet({
  key: 'foo',
  factory: getFromDb(),
  tags: ['tag-1', 'tag-2']
});

await bento.deleteByTag({ tags: ['tag-1'] });
```

### Namespaces

Another way to group your keys is to use namespaces. This allows you to invalidate everything at once later :

```ts
const users = bento.namespace('users')

users.set({ key: '32', value: { name: 'foo' } })
users.set({ key: '33', value: { name: 'bar' } })

users.clear()
```

### Events

Events are emitted by Bentocache throughout its execution, allowing you to collect metrics and monitor your cache.

```ts
bento.on('cache:hit', () => {})
bento.on('cache:miss', () => {})
// ...
```

See the [events documentation](./digging_deeper/events.md) for more information.

### Friendly TTLs

All TTLs can be passed in a human-readable string format. We use [lukeed/ms](https://github.com/lukeed/ms) under the hood. (this is optional, and you can pass a `number` in milliseconds if you prefer)

```ts
bento.getOrSet({
  key: 'foo',
  factory: () => getFromDb(),
  ttl: '2.5h',
})
```

In this case, when only 20% or less of the TTL remains and the entry is requested :

- It will return the cached value to the user.
- Start a background refresh by calling the factory.
- Next time the entry is requested, it will be already computed, and can be returned immediately.

### Logging

You can pass a logger to Bentocache, and it will log everything that happens. Can be useful for debugging or monitoring.

```ts
import { pino } from 'pino'

const bento = new BentoCache({
  logger: pino()
})
```

See the [logging documentation](./digging_deeper/logging.md) for more information.

## Sponsor

If you like this project, [please consider supporting it by sponsoring it](https://github.com/sponsors/Julien-R44/). It will help a lot to maintain and improve it. Thanks a lot !

## Prior art and inspirations

Bentocache was inspired by several other caching libraries and systems. Especially [FusionCache](https://github.com/ZiggyCreatures/FusionCache), which is probably the most advanced caching library I've ever seen, no matter the language. Huge kudos to the author for his amazing work.

- https://github.com/ZiggyCreatures/FusionCache
- https://laravel.com/docs/10.x/cache
- https://github.com/TurnerSoftware/CacheTower
- https://github.com/dotnetcore/EasyCaching
- https://symfony.com/doc/current/components/cache.html
