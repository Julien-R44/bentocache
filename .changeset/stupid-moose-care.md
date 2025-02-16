---
'bentocache': minor
---

Add `skipL2Write` and `skipBusNotify` options. 

```ts
await cache.getOrSet({
  key: 'foo',
  skipL2Write: true,
  skipBusNotify: true,
  factory: () => 'foo'
})
```

When enabled, `skipL2Write` will prevent the entry from being written to L2 cache, and `skipBusNotify` will prevent any notification from being sent to the bus. You will probably never need to use these options, but they were useful for internal code, so decided to expose them.
