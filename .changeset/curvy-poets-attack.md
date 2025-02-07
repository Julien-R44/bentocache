---
'bentocache': minor
---

Add two new functions in the factory callback context:

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
  }
})
```

## Skip

Returning `skip` in a factory will not cache the value, and `getOrSet` will returns `undefined` even if there is a stale item in cache.
It will force the key to be recalculated on the next call.

## Fail

Returning `fail` in a factory will not cache the value and will throw an error. If there is a stale item in cache, it will be used.
