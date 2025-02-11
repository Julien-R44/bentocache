---
'bentocache': minor
---

Add a new `expire` method.

This method is slightly different from `delete`:

When we delete a key, it is completely removed and forgotten. This means that even if we use grace periods, the value will no longer be available.

`expire` works like `delete`, except that instead of completely removing the value, we just mark it as expired but keep it for the grace period. For example:

```ts
// Set a value with a grace period of 6 minutes
await cache.set({ 
  key: 'hello',
  value: 'world',
  grace: '6m'
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
