---
'bentocache': minor
---

Add a new `E_L2_CACHE_ERROR`. Before this commit, error happening when interacting with the L2 cache were not wrapped in a custom error. This is now the case. If needed, you can still access the original error by using the `cause` property of the `E_L2_CACHE_ERROR` error.

```ts
import { errors } from 'bentocache';

try {
  await cache.getOrSet({
    key: 'foo',
    factory: getFromDb()
  }) 
} catch (err) {
  if (err instanceof errors.E_L2_CACHE_ERROR) {
    console.error('An error happened while interacting with the L2 cache', err.cause);
  }
}
```
