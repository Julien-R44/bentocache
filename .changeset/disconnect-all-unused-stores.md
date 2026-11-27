---
'bentocache': patch
---

`disconnectAll()` now only disconnects the stores that were actually created. Previously it instantiated every configured store just to disconnect it, which opened a Redis connection at shutdown for a Redis store that was never used.
