---
'@bentocache/otel': patch
---

Fix wrong span parenting. Each cache operation span is now the active context while the operation runs, so:

- cache operations from concurrent requests on the same key no longer end up in another request's trace
- spans created inside a `getOrSet` factory (database queries, nested cache calls) are children of the `cache.factory` span
- the instrumentation scope reports the package version instead of `0.1.0`

This relies on `context.attach()` from `@opentelemetry/api` 1.10, which `AsyncLocalStorageContextManager` (the Node.js SDK default) supports. `manuallyRegister()` now logs a warning when it cannot patch the `BentoCache` constructor, because `suppressInternalOperations` has no effect in that case.
