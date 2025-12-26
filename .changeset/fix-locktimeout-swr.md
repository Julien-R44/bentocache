---
'bentocache': patch
---

Fix lockTimeout overriding timeout:0 SWR behavior. When timeout is set to 0 (stale-while-revalidate mode), subsequent requests made during background revalidation now return stale data immediately as expected, regardless of lockTimeout setting. Fixes #103

