---
summary: 'Discover how to use multi-tier Caching with Bentocache: combines in-memory and distributed caches for optimal performance.'
---

# Multi Tier

A multi-tier caching system can be very useful when you want to boost even more the performance of you caching strategy.

To do that, we generally use a in-memory cache as the first level cache, and a distributed cache as the second level cache. In-memory cache is really fast, but it is limited by the amount of memory available on your server. Distributed cache is slower, but can store a lot more data, and is shared between your different instances.

So by using a multi-tier cache, you can have the best of both worlds. Here is a simplified diagram of the flow :

![Bentocache Flow](content/docs/bentocache_flow.webp)

## Setup

To create a multi-tier cache with Bentocache, just combine `useL1Layer()` and `useL2Layer()` methods when creating your cache instance. You can also use `useBus()` to add a bus to synchronize the different in-memory caches between the different instances of your application.

:::note
If your application is running on a single instance, you don't need to bother with the bus. Just use `useL1Layer()` and `useL2Layer()`.
:::

```ts
import { BentoCache, bentostore } from 'bentocache'
import { memoryDriver } from 'bentocache/drivers/memory'
import { redisDriver, redisBusDriver } from 'bentocache/drivers/redis'

const redisConnection = { host: 'localhost', port: 6379 }
const bento = new BentoCache({
  default: 'multitier',

  stores: {
    multitier: bentostore()
      // Your L1 Cache. Here, an in-memory cache with
      // a maximum size of 10Mb
      .useL1Layer(memoryDriver({ maxSize: '10mb' }))
      // Your L2 Cache. Here, a Redis cache
      .useL2Layer(redisDriver({ connection: redisConnection }))
      // Finally, the bus to synchronize the L1 caches between
      // the different instances of your application
      .useBus(redisBusDriver({ connection: redisConnection })),
  },
})
```

So here, We have defined a multi-tier cache with :

- L1: An in-memory cache with a maximum size of 10Mb. After that, the LRU algorithm will be used to remove the least recently used items.
- L2: A distributed cache using Redis.
- And a Redis bus to synchronize the in-memory caches between the different instances of your application. The redis bus leverage Redis Pub/Sub system to send messages between instances.

Then, usage is the same as any other cache driver. You can use every method you would use on a normal cache driver. Synchronization between instances, writing to the different caches, etc. everything is handled internally by Bentocache.

## Bus

The bus play a crucial role in a multi-tier cache context. It is used to synchronize the different in-memory caches between the different instances of your application.

Let's try to understand why we need it in the first place. We have an applications with 2 instances running in parallel with PM2.

- `N1` is calling `bento.getOrSet({ key: 'user:1', factory: () => fetchUser(1) })`
- `N1` is saving the result in in-memory cache + distributed cache.

- After some times, `N2` is also calling `bento.getOrSet({ key: 'user:1', factory: () => fetchUser(1) })`
- `N2` check his memory cache, but found nothing. So it fetches data from distributed cache, and saves it in memory cache.

- `N1` received an update for the user model. So we need to invalidate the cache for `user:1`.
- `N1` invalidates the cache for `user:1` in his in-memory cache, and in the distributed cache. Key doesn't exist anymore in both caches.

- However, `N2` is still holding the old value in his in-memory cache. he doesn't know that the key has been invalidated. So next time it search for `user:1` key, it will find it in his in-memory cache, and will return the old value.

See the problem ? That's why the bus is needed.

### How the bus works

The bus is, as the name suggests, just a bus and messaging system. With the `redisBusDriver` we are leveraging Redis Pub/Sub system to send messages between instances.

Every time a key is invalidated or updated, the instance will notify other ones by sending a message saying "Hey, this key has been invalidated, you should delete it from your cache". Note that we are not sending the new value to other instances, for multiple reasons :

- Maybe the other instance will never need this key. So let's not waste memory space on this instance. It will fetch the value from the distributed cache if needed.
- We also save network bandwidth and not overload the bus with serialized data of the value.

Bus messages are also encoded using a custom binary format instead of plain JSON. This allows us to save a lot of space and bandwidth. Also, `JSON.stringify()` and `JSON.parse()` are notoriously slow.

### Retry queue strategy

The bus also has a retry queue strategy. If an instance fails to publish a message through the bus, it will be added to a retry queue. As soon as we can publish messages again, we will try to process that queue and send the messages.

This can be configured through the `redisBusDriver` options as follow :

```ts
redisBusDriver({
  retryQueue: {
    enabled: true,
    maxSize: undefined,
  },
})
```

`maxSize` is the maximum number of items that can be stored in the retry queue. If the queue is full, the oldest item will be dropped. If `undefined`, the queue will have no limit.

### Postgres bus

If you already run Postgres, you can use it as the bus instead of Redis. `postgresBusDriver` uses Postgres `LISTEN/NOTIFY`. Combined with an in-memory L1 and, optionally, a [database L2](./cache_drivers.md), it lets you run a multi-tier cache without Redis.

Install the `pg` package first:

```sh
npm i pg
```

With TypeScript, also install `@types/pg`.

```ts
import { BentoCache, bentostore } from 'bentocache'
import { memoryDriver } from 'bentocache/drivers/memory'
import { postgresBusDriver } from 'bentocache/drivers/postgres'

const bento = new BentoCache({
  default: 'cache',
  stores: {
    cache: bentostore()
      .useL1Layer(memoryDriver({ maxSize: '10mb' }))
      .useBus(postgresBusDriver({ connection: process.env.DATABASE_URL! })),
  },
})
```

`connection` takes a connection string or a [`pg` client config](https://node-postgres.com/apis/client). From it, the driver opens two connections per store and per process: one that listens and one that publishes. It doesn't create any table or other database object.

All your instances must connect to the same database: Postgres delivers notifications only within a database.

#### Options

| Option           | Default                               | Description                                                                                                                                                                                                                                                |
| ---------------- | ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `connection`     |                                       | Connection string or `pg` client config. Required.                                                                                                                                                                                                         |
| `publishTimeout` | `'2s'`                                | Maximum time for one publish transaction, which carries up to 1,000 notifications or 1 MB. A publish that takes longer fails and goes to the [retry queue](#retry-queue-strategy).                                                                         |
| `batchDelay`     | `0`                                   | Extra time the driver waits after a message before sending it, so that more messages share one transaction. Every write (`set`, `delete`, `clear`...) waits for its publish, so a delay adds to write latency in exchange for fewer Postgres transactions. |
| `heartbeat`      | `{ interval: '30s', timeout: '15s' }` | Every `interval`, the driver publishes a message to itself. If a heartbeat was committed but not received within `timeout`, the listening connection is replaced. Set to `false` to disable. See [Heartbeat](#heartbeat).                                  |
| `onError`        |                                       | Called with connection errors, failed publishes and dropped messages, for logging. The driver reconnects on its own. Without it, errors are logged with `console.error`, each distinct message at most once a minute.                                      |
| `retryQueue`     |                                       | Same as for `redisBusDriver`.                                                                                                                                                                                                                              |

#### What the connection must support

The connection must reach the primary, directly or through a proxy, and `LISTEN` must work on it:

- A direct connection to Postgres, or a TCP proxy such as HAProxy that routes to the primary, works.
- PgBouncer works in session mode. In transaction mode, `LISTEN` doesn't work.
- Other poolers work if they support `LISTEN/NOTIFY` in the mode you use. PgDog, for example, needs its pub/sub support enabled in transaction mode.

Many hosting providers show a pooled connection string in transaction mode by default. Use a direct or session-mode one instead:

- Supabase: the direct connection, or the session pooler on port 5432. Not the transaction pooler on port 6543.
- Neon: the hostname without `-pooler`.
- DigitalOcean: the database cluster itself, not a connection pool in transaction mode.
- Azure Database for PostgreSQL: port 5432. The built-in PgBouncer on port 6432 works only if its pool mode is `session`.

If `LISTEN` doesn't work on the connection, the heartbeat fails and the driver reports it every time it reconnects. See [If the heartbeat fails](#if-the-heartbeat-fails).

If a proxy closes idle connections, such as HAProxy with its `timeout client` and `timeout server` settings, keep `heartbeat.interval` below that timeout. The heartbeat is what keeps both connections active. The same applies to the database's `idle_session_timeout`, if you set one: the publishing connection keeps it, and is replaced if it is closed.

Don't use the Postgres bus where processes are frozen between requests, such as AWS Lambda. A frozen process reads no notifications, so its L1 keeps old values, and its listening session holds back the server's notification queue (see below).

#### How it behaves

- Messages are sent in short transactions, each in one round trip, with `synchronous_commit` turned off for that transaction. Every such transaction uses a transaction id, writes to the WAL, takes a lock shared by the whole Postgres cluster and wakes every listening connection, so the driver sends as few as it can:
  - A message is sent as soon as no transaction is running. Messages published while one runs are sent together in the next. With a `batchDelay`, a batch also waits that long after its first message, unless it already holds 1,000 messages.
  - Messages in a batch with the same type and namespace are merged into one notification, with duplicate keys removed. Other instances can therefore see fewer `bus:message:received` events than were published, and messages of different types or namespaces can arrive in a different order. The caches end up the same, because every message only deletes or expires entries.
  - A very large batch is split over several transactions.
- BentoCache waits for the publish in every write, so each `set`, `delete` or `clear` takes at least one round trip to the primary, plus `batchDelay`.
- Right after start, publishes wait for the first connection, up to `publishTimeout`. Later, while the publishing connection is down, publishes fail right away and go to the retry queue. They are sent as soon as the connection is back. The retry queue resends one message at a time, each in its own transaction.
- `disconnect()` first sends the messages still waiting, within `publishTimeout`.
- Postgres limits a notification to 8000 bytes. Messages with many keys are split across several notifications. If a single key doesn't fit, or a key isn't a string, the driver sends a `clear` of the key's namespace instead and reports it to `onError`. This only keeps other instances from serving stale entries: only key names are sent, never values, so it takes a key name of about 8 KB, which is very unlikely.
- Messages sent while an instance's listening connection is down, including right after start before it is ready, are lost for that instance. Its L1 can then keep old values until they expire, so use a TTL you can accept as the worst case for stale reads from L1.
- Each store uses its own channel, named after the store. Two applications that share a database and use the same store name receive each other's messages, and delete each other's L1 entries with the same keys. Give them different store names.
- If you connect through PgDog, it forwards notifications through a buffer of `pub_sub_channel_size` entries and drops them, without an error, for a client that falls more than that many behind. The load to size for is notifications per second times the number of app instances behind one PgDog. Merging keeps that number low, but check PgDog's `SHOW LISTENERS` for a non-zero `dropped` column under your peak load.

#### Heartbeat

The listening connection only receives, so it can't always tell when it stops working:

- A pooler in transaction mode accepts `LISTEN` but never delivers anything.
- A load balancer, NAT gateway or firewall can drop an idle connection without telling either end.
- If the database host goes away or the network is cut, nothing tells the client until it sends something.

In these cases the connection stays open while notifications are lost, and the instance's L1 keeps old values until they expire. So every `interval` (30 s by default), the driver sends a notification to itself. If one isn't received within `timeout` (15 s by default), the driver replaces the listening connection and reports an error. A silent failure is detected within `interval` + `timeout` + `timeout` / 3, about 50 s with the defaults.

The heartbeat also keeps both connections active, so a proxy that closes idle connections after longer than `interval` leaves them open.

Each heartbeat is a small publish transaction. While messages are being published, it goes in one of their transactions. With no traffic, each store in each process sends one every `interval`, which is 2,880 transactions a day at the default. Every one of them wakes every listening session in the database, so with 100 processes the database handles about 3 heartbeat transactions and 330 wakeups per second. With many processes, a longer `interval` lowers this.

##### If the heartbeat fails

The error `Postgres bus listener did not receive a heartbeat` means that a heartbeat was committed, but the listening connection didn't receive it in time. The driver replaces the connection on its own. Once, for example during a failover, it needs no action. If it repeats, check for:

- **A pooler in transaction mode.** `LISTEN` appears to work, but nothing is delivered. Use a direct or session-mode connection, see [What the connection must support](#what-the-connection-must-support).
- **Connections that reach different servers.** Notifications are delivered only within one server. Both connections must reach the same primary, which a proxy that spreads new connections over several nodes doesn't guarantee.
- **Something closing idle connections.** A proxy, load balancer or firewall with an idle timeout shorter than `heartbeat.interval`. Lower the interval below that timeout, or raise the timeout.
- **An unstable network.** The driver recovers each time, but messages are lost for that instance while it reconnects.
- **An overloaded process.** If the process can't read from its connection for longer than `timeout`, the heartbeat arrives too late. Time the process was completely frozen, such as a long garbage collection, is not counted. Raise `timeout` if your process is often busy for that long.

##### Turning the heartbeat off

`heartbeat: false` is safe only if both of these hold:

- The app connects to Postgres directly, with no pooler, proxy, load balancer or NAT between them, for example on the same host.
- You accept that, if a connection silently stops working, the instance's L1 may serve old values until they expire, with no error. A short L1 TTL limits how long.

Without the heartbeat, the driver still reconnects whenever a connection reports an error or is closed. That covers server restarts, terminated sessions and most failovers. A connection that is silently dropped is found only by TCP keepalive, which the driver turns on, but which with operating system defaults can take hours. The `pg` option `keepAliveInitialDelayMillis` shortens it.

#### Effect on the rest of your database

The bus shares the database with your application. It changes nothing outside its own sessions, but its transactions cost the whole server something:

- **Connections:** each store with a Postgres bus uses two connections per process. Count them when you size `max_connections` or your pooler.
- **Transaction ids:** every publish transaction uses a transaction id and writes a small WAL record that is replicated. At 1,000 transactions per second that is 86.4 million ids a day, so anti-wraparound vacuums of your tables come sooner (they start at `autovacuum_freeze_max_age`, 200 million by default). A `batchDelay` lowers the count. With no traffic, the [heartbeat](#heartbeat) still uses one every `interval` per store and process, so the database is never fully idle.
- **Notification lock:** Postgres runs commits that send notifications one at a time, using a lock shared by all databases on the server. Your other queries and transactions don't take it, but any other application on the same server that uses `NOTIFY` competes with the bus for it. The driver turns off `synchronous_commit` for its transactions to hold the lock briefly.
- **Notification queue:** notifications wait in a queue shared by all databases on the server (8 GB by default) until every listening session has read them. A listening session that stops reading, such as a frozen process or a session left inside a long transaction, holds the queue back. If it fills up, every `NOTIFY` on the server fails at commit. The driver's listener never opens a transaction, and the heartbeat replaces a listener that stops receiving while its process still runs.
- **Other listeners:** each commit wakes the sessions that listen in the same database, including your application's own listeners on other channels.
- **Session settings:** the driver changes only its own sessions. It sets `synchronous_commit = off` inside each publish transaction, and turns off `idle_session_timeout` (Postgres 14 and later) on its listening connection, since that connection is idle by design. It does so even when no timeout is set, so a timeout enabled later by a config reload doesn't close the listener. It uses a plain `SET`, which poolers such as PgDog keep to that client. It doesn't change `pg` defaults, type parsers or the config object you pass.
