# @bentocache/otel

## 0.2.0

### Minor Changes

- ffbbfbe: Upgrade to OpenTelemetry JS SDK 3 (`@opentelemetry/core` 3.x, `@opentelemetry/instrumentation` 0.301.x). `@opentelemetry/api` is now a peer dependency (`^1.10.0`), and Node.js 22.15.0 or newer is required.

  **Breaking change:** apps that stay on OpenTelemetry SDK 2 (`@opentelemetry/api` < 1.10) must keep using `@bentocache/otel@0.1.x`.

### Patch Changes

- 057a839: Fix concurrent `getOrSet` calls with the same key producing deeply nested spans instead of siblings
- ffbbfbe: Fix wrong span parenting. Each cache operation span is now the active context while the operation runs, so:

  - cache operations from concurrent requests on the same key no longer end up in another request's trace
  - spans created inside a `getOrSet` factory (database queries, nested cache calls) are children of the `cache.factory` span
  - the instrumentation scope reports the package version instead of `0.1.0`

  This relies on `context.attach()` from `@opentelemetry/api` 1.10, which `AsyncLocalStorageContextManager` (the Node.js SDK default) supports. `manuallyRegister()` now logs a warning when it cannot patch the `BentoCache` constructor, because `suppressInternalOperations` has no effect in that case.

## 0.1.2

### Patch Changes

- 1831908: Update OpenTelemetry dependencies to v2

## 0.1.1

### Patch Changes

- 07deb53: Add new package `@bentocache/otel` for OpenTelemetry instrumentation. This package provides automatic instrumentation for BentoCache.
  Also updated Tracing Channels inside Bentocache to provide better support for OpenTelemetry.
