---
'bentocache': patch
---

- Fix Redis driver not respecting the `keyPrefix` option from `ioredis` when using the `clear()` method
- Fix namespace conflict where keys containing a namespace name as a substring were incorrectly cleared. For example, a key named `usersAbc` was incorrectly evicted when calling `cache.namespace('users').clear()`. Now, only keys with an exact namespace prefix match (`users:`) will be cleared.
