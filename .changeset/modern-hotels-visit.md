---
'bentocache': minor
---

Added a `forceFresh` option to the `getOrSet` method. This option allows you to force the factory to be re-executed and its result to be cached, even if a valid value is already present in the cache. Can be useful for debugging purposes or when you promptly want to have a fresh value.
