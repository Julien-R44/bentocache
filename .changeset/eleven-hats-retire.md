---
'bentocache': patch
---

Refactoring of CacheEntryOptions class. We switch to a simple function that returns an object rather than a class. Given that CacheEntryOptions is heavily used : it was instantiated for every cache operation, we gain a lot in performance.
