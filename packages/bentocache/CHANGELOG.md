# bentocache

## 1.6.1

### Patch Changes

- 07deb53: Add new package `@bentocache/otel` for OpenTelemetry instrumentation. This package provides automatic instrumentation for BentoCache.
  Also updated Tracing Channels inside Bentocache to provide better support for OpenTelemetry.

## 1.6.0

### Minor Changes

- f54e5e0: Add experimental support for Node.js Diagnostic Channels (TracingChannel) for cache operations instrumentation.

  This enables APM tools and OpenTelemetry to trace cache operations with timing information:

  ```ts
  import { tracingChannels } from 'bentocache'

  tracingChannels.cacheOperation.start.subscribe((message) => {
    console.log(`Starting ${message.operation} on ${message.key}`)
  })

  tracingChannels.cacheOperation.asyncEnd.subscribe((message) => {
    console.log(`Completed with hit=${message.hit}, tier=${message.tier}`)
  })
  ```

  Traced operations: `get`, `set`, `delete`, `deleteMany`, `clear`, `expire`, and `getOrSet` (as get + set on miss).

## 1.5.1

### Patch Changes

- 82e6ce6: Add support for Cluster with bus
- c4d7a93: Fix lockTimeout overriding timeout:0 SWR behavior. When timeout is set to 0 (stale-while-revalidate mode), subsequent requests made during background revalidation now return stale data immediately as expected, regardless of lockTimeout setting. Fixes #103
- 67e059b: Delete cache file if corrupted. See #93
- 96eb649: Remove database entries with correct prefixed keys
- dbd214e: Fix CROSSSLOT error when using `clear()` or `deleteMany()` with Valkey. Now uses pipeline with individual unlink commands instead of batch unlink.

## 1.5.0

### Minor Changes

- eb29853: Add `prune()` method for cache drivers without native TTL support as an alternative to `pruneInterval` strategy

## 1.4.0

### Minor Changes

- 2c5e4e7: Cleaner Worker Thread logs for the file driver now use the configured logger for better integration with structured logging system

  See [#74](https://github.com/Julien-R44/bentocache/issues/74)

### Patch Changes

- 5941f90: Fix race condition with file driver writing corrupted data to disk

  See [#74](https://github.com/Julien-R44/bentocache/issues/74)

- 5009b58: Fix bus synchronization issue when prefix is empty

## 1.3.0

### Minor Changes

- 25073fa: Added a `forceFresh` option to the `getOrSet` method. This option allows you to force the factory to be re-executed and its result to be cached, even if a valid value is already present in the cache. Can be useful for debugging purposes or when you promptly want to have a fresh value.

### Patch Changes

- e0a9094: - Fix Redis driver not respecting the `keyPrefix` option from `ioredis` when using the `clear()` method
  - Fix namespace conflict where keys containing a namespace name as a substring were incorrectly cleared. For example, a key named `usersAbc` was incorrectly evicted when calling `cache.namespace('users').clear()`. Now, only keys with an exact namespace prefix match (`users:`) will be cleared.

## 1.2.2

### Patch Changes

- c932ac5: Disable TTL Autopurge du driver memoire. It allows to avoid overflow errors when a TTL of +25 days is set. See issue [#61](https://github.com/Julien-R44/bentocache/issues/61) for more information.
- 0a2b25c: Fix `has` returning `true` on entries previously deleted by tag (see #64). The `has` method now relies on the driver's internal `get` method instead of `has`. This means the driver's `has` implementation is no longer used, and if you maintain a custom driver, you can safely remove it.
- 6b01e1c: Fix knex driver throwing an error when quickly disconnecting from the database after application start. See https://github.com/adonisjs/cache/issues/12#issuecomment-2791372837
- 73d25cd: Update clear method to use SCAN instead of KEYS for non-blocking. Also replace `del` commands with `unlink` since this is non blocking.

## 1.2.1

### Patch Changes

- 1e54547: Updated dependencies, including @boringnode/bus which includes a change for attempting to fix #58

## 1.2.0

### Minor Changes

- 8bb87b6: Add a new `expire` method.

  This method is slightly different from `delete`:

  When we delete a key, it is completely removed and forgotten. This means that even if we use grace periods, the value will no longer be available.

  `expire` works like `delete`, except that instead of completely removing the value, we just mark it as expired but keep it for the grace period. For example:

  ```ts
  // Set a value with a grace period of 6 minutes
  await cache.set({
    key: 'hello',
    value: 'world',
    grace: '6m',
  })

  // Expire the value. It is kept in the cache but marked as STALE for 6 minutes
  await cache.expire({ key: 'hello' })

  // Here, a get with grace: false will return nothing, because the value is stale
  const r1 = await cache.get({ key: 'hello', grace: false })

  // Here, a get with grace: true will return the value, because it is still within the grace period
  const r2 = await cache.get({ key: 'hello' })

  assert.deepEqual(r1, undefined)
  assert.deepEqual(r2, 'world')
  ```

- d513fe2: Add a new `E_L2_CACHE_ERROR`. Before this commit, error happening when interacting with the L2 cache were not wrapped in a custom error. This is now the case. If needed, you can still access the original error by using the `cause` property of the `E_L2_CACHE_ERROR` error.

  ```ts
  import { errors } from 'bentocache'

  try {
    await cache.getOrSet({
      key: 'foo',
      factory: getFromDb(),
    })
  } catch (err) {
    if (err instanceof errors.E_L2_CACHE_ERROR) {
      console.error('An error happened while interacting with the L2 cache', err.cause)
    }
  }
  ```

- 4d1feb5: Added a super simple circuit breaker system to the L2 Cache :

  - a `l2CircuitBreakerDuration` parameter to set the duration of the circuit breaker. How many seconds the circuit breaker will stay open.
  - If defined, the circuit breaker will open when a call to our distributed cache fails. It will stay open for `l2CircuitBreakerDuration` seconds.

  We may introduce more sophisticated circuit breaker system in the future, but for now, this simple system should be enough.

- 6b1f42a: Enhance Factory Context by adding some new props.

  ```ts
  await cache.getOrSet({
    key: 'foo',
    factory: (ctx) => {
      // You can access the graced entry, if any, from the context
      if (ctx.gracedEntry?.value === 'bar') {
        return 'foo'
      }

      // You should now use `setOptions` to update cache entry options
      ctx.setOptions({
        tags: ['foo'],
        ttl: '2s',
        skipL2Write: true,
      })

      return 'foo'
    },
  })
  ```

  `setTtl` has been deprecated in favor of `setOptions` and will be removed in the next major version.

- 73ac0fa: Add **experimental** tagging support. See https://github.com/Julien-R44/bentocache/issues/53

  ```ts
  await bento.getOrSet({
    key: 'foo',
    factory: getFromDb(),
    tags: ['tag-1', 'tag-2'],
  })

  await bento.set({
    key: 'foo',
    tags: ['tag-1'],
  })
  ```

  Then, we can delete all entries tagged with tag-1 using:

  ```ts
  await bento.deleteByTags({ tags: ['tag-1'] })
  ```

  As this is a rather complex feature, let's consider it experimental for now. Please report any bugs on Github issues

- 6b1f42a: Add `skipL2Write` and `skipBusNotify` options.

  ```ts
  await cache.getOrSet({
    key: 'foo',
    skipL2Write: true,
    skipBusNotify: true,
    factory: () => 'foo',
  })
  ```

  When enabled, `skipL2Write` will prevent the entry from being written to L2 cache, and `skipBusNotify` will prevent any notification from being sent to the bus. You will probably never need to use these options, but they were useful for internal code, so decided to expose them.

- b9db3b5: Rework the logs issued by bentocache to make them much cleaner, more consistent and make debug easier

### Patch Changes

- 491d12e: Handle deleteMany with empty keys list

## 1.1.0

### Minor Changes

- 07224ba: Add two new functions in the factory callback context:

  ```ts
  cache.getOrSet({
    key: 'foo',
    factory: ({ skip, fail }) => {
      const item = await getFromDb()
      if (!item) {
        return skip()
      }

      if (item.isInvalid) {
        return fail('Item is invalid')
      }

      return item
    },
  })
  ```

  ## Skip

  Returning `skip` in a factory will not cache the value, and `getOrSet` will returns `undefined` even if there is a stale item in cache.
  It will force the key to be recalculated on the next call.

  ## Fail

  Returning `fail` in a factory will not cache the value and will throw an error. If there is a stale item in cache, it will be used.

- 2578357: Added a `serialize: false` to the memory driver.

  It means that, the data stored in the memory cache will not be serialized/parsed using `JSON.stringify` and `JSON.parse`. This allows for a much faster throughput but at the expense of:

  - not being able to limit the size of the stored data, because we can't really know the size of an unserialized object
  - Having inconsistent return between the L1 and L2 cache. The data stored in the L2 Cache will always be serialized because it passes over the network. Therefore, depending on whether the data is retrieved from the L1 and L2, we can have data that does not have the same form. For example, a Date instance will become a string if retrieved from the L2, but will remain a Date instance if retrieved from the L1. So, you should put extra care when using this feature with an additional L2 cache.

### Patch Changes

- 09cd234: Refactoring of CacheEntryOptions class. We switch to a simple function that returns an object rather than a class. Given that CacheEntryOptions is heavily used : it was instantiated for every cache operation, we gain a lot in performance.
- 1939ab9: Deleted the getters usage in the CacheEntryOptions file. Looks like getters are super slow. Just removing them doubled the performance in some cases.

  Before :

  ```sh
  ┌─────────┬──────────────────────────────────┬─────────────────────┬─────────────────────┬────────────────────────┬────────────────────────┬─────────┐
  │ (index) │ Task name                        │ Latency avg (ns)    │ Latency med (ns)    │ Throughput avg (ops/s) │ Throughput med (ops/s) │ Samples │
  ├─────────┼──────────────────────────────────┼─────────────────────┼─────────────────────┼────────────────────────┼────────────────────────┼─────────┤
  │ 0       │ 'L1 GetOrSet - BentoCache'       │ '16613 ± 97.87%'    │ '1560.0 ± 45.00'    │ '613098 ± 0.10%'       │ '641026 ± 19040'       │ 83796   │
  │ 1       │ 'L1 GetOrSet - CacheManager'     │ '953451 ± 111.03%'  │ '160022 ± 3815.00'  │ '5700 ± 1.23%'         │ '6249 ± 151'           │ 1049    │
  │ 4       │ 'Tiered GetOrSet - BentoCache'   │ '16105 ± 98.11%'    │ '1515.0 ± 45.00'    │ '636621 ± 0.08%'       │ '660066 ± 20206'       │ 86675   │
  │ 5       │ 'Tiered GetOrSet - CacheManager' │ '877297 ± 111.36%'  │ '161617 ± 2876.00'  │ '5948 ± 0.67%'         │ '6187 ± 112'           │ 1140    │
  │ 6       │ 'Tiered Get - BentoCache'        │ '1542.4 ± 4.43%'    │ '992.00 ± 18.00'    │ '973931 ± 0.03%'       │ '1008065 ± 17966'      │ 648343  │
  │ 7       │ 'Tiered Get - CacheManager'      │ '1957.6 ± 0.51%'    │ '1848.0 ± 26.00'    │ '534458 ± 0.02%'       │ '541126 ± 7722'        │ 510827  │
  └─────────┴──────────────────────────────────┴─────────────────────┴─────────────────────┴────────────────────────┴────────────────────────┴─────────┘
  ```

  After:

  ```sh
  ┌─────────┬──────────────────────────────────┬─────────────────────┬─────────────────────┬────────────────────────┬────────────────────────┬─────────┐
  │ (index) │ Task name                        │ Latency avg (ns)    │ Latency med (ns)    │ Throughput avg (ops/s) │ Throughput med (ops/s) │ Samples │
  ├─────────┼──────────────────────────────────┼─────────────────────┼─────────────────────┼────────────────────────┼────────────────────────┼─────────┤
  │ 0       │ 'L1 GetOrSet - BentoCache'       │ '9610.3 ± 98.26%'   │ '1109.0 ± 29.00'    │ '879036 ± 0.05%'       │ '901713 ± 22979'       │ 143980  │
  │ 1       │ 'L1 GetOrSet - CacheManager'     │ '906687 ± 110.96%'  │ '172470 ± 1785.00'  │ '5601 ± 0.56%'         │ '5798 ± 61'            │ 1103    │
  │ 4       │ 'Tiered GetOrSet - BentoCache'   │ '8752.8 ± 98.40%'   │ '1060.0 ± 19.00'    │ '924367 ± 0.04%'       │ '943396 ± 17219'       │ 158461  │
  │ 5       │ 'Tiered GetOrSet - CacheManager' │ '925163 ± 111.45%'  │ '173578 ± 2970.00'  │ '5590 ± 0.55%'         │ '5761 ± 100'           │ 1081    │
  │ 6       │ 'Tiered Get - BentoCache'        │ '556.57 ± 0.52%'    │ '511.00 ± 10.00'    │ '1923598 ± 0.01%'      │ '1956947 ± 37561'      │ 1796720 │
  │ 7       │ 'Tiered Get - CacheManager'      │ '2060.2 ± 2.54%'    │ '1928.0 ± 20.00'    │ '513068 ± 0.02%'       │ '518672 ± 5325'        │ 485387  │
  └─────────┴──────────────────────────────────┴─────────────────────┴─────────────────────┴────────────────────────┴────────────────────────┴─────────┘
  ```

  Pretty good improvement 😁

## 1.0.0

- eeb3c8c: BREAKING CHANGES:
  This commit changes the API of the `gracePeriod` option.
  - `gracePeriod` is now `grace` and should be either `false` or a `Duration`.
  - If you were using the `fallbackDuration` option, you should now use the `graceBackoff` option at the root level.
- 82e9d6c: Previously, `suppressL2Errors` was automatically enabled even when we had just a L2 layer. Which can be confusing, because errors were filtered out.

  Now `suppressL2Errors` is a bit more intelligent and will only be enabled if you have a L1 layer. Unless you explicitly set it to `true`.

- 716a423: BREAKING CHANGES :

  `undefined` values are forbidden in the cache. If you are trying to cache `undefined`, you will now get an error. This is a breaking change because it was previously allowed.

  If you want to cache something to represent the absence of a value, you can use `null` instead of `undefined`.

- 4478db6: BREAKING CHANGES

  ## API Changes for timeouts

  The timeout options have changed APIs:
  `{ soft: '200ms', hard: '2s' }`

  Becomes:

  ```ts
  getOrSet({ timeout: '200ms', hardTimeout: '2s' })
  ```

  You can now also use `0` for `timeout` which means that, if a stale value is available, then it will be returned immediately, and the factory will run in the background. SWR-like, in short.

  ## Default timeout

  Now, the default timeout is `0`. As explained above, this enables the SWR-like behavior by default, which is a good default for most cases and what most people expect.

- 7ae55e2: Added an `onFactoryError` option that allows to catch errors that happen in factories, whether they are executed in background or not.

  ```ts
  const result = await cache.getOrSet({
    key: 'foo',
    grace: '5s',
    factory: () => {
      throw new MyError()
    },
    onFactoryError: (error) => {
      // error is an instance of errors.E_FACTORY_ERROR
      // error.cause is the original error thrown by the factory
      // you can also check if the factory was executed in background with error.isBackgroundFactory
      // and also get the key with error.key. Will be `foo` in this case
    },
  })
  ```

- 27a295d: Keep only POJO syntax

  This commit remove the "legacy" syntax and only keep the POJO syntax.
  For each method, the method signature is a full object, for example :

  ```ts
  bento.get({ key: 'foo ' })
  bento.getOrSet({
    key: 'foo',
    factory: () => getFromDb(),
  })
  ```

- f0b1008: The memory driver can now accept `maxSize` and `maxEntrySize` in human format. For example, `maxSize: '1GB'` or `maxEntrySize: '1MB'`.

  We use https://www.npmjs.com/package/bytes for parsing so make sure to respect the format accepted by this module.

- a8ac574: This commit adds a new custom behavior for handling GetSet operation when end-user is using a single L2 storage without L1 cache.
