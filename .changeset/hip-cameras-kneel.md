---
'bentocache': minor
---

Enhance Factory Context by adding some new props. 

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

    return 'foo';
  }
})
```

`setTtl` has been deprecated in favor of `setOptions` and will be removed in the next major version. 
