---
'bentocache': minor
---

BREAKING CHANGES :

`undefined` values are forbidden in the cache. If you are trying to cache `undefined`, you will now get an error. This is a breaking change because it was previously allowed.

If you want to cache something to represent the absence of a value, you can use `null` instead of `undefined`.
