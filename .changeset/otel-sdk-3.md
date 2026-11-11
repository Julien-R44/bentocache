---
'@bentocache/otel': minor
---

Upgrade to OpenTelemetry JS SDK 3 (`@opentelemetry/core` 3.x, `@opentelemetry/instrumentation` 0.301.x). `@opentelemetry/api` is now a peer dependency (`^1.10.0`), and Node.js 22.15.0 or newer is required.

**Breaking change:** apps that stay on OpenTelemetry SDK 2 (`@opentelemetry/api` < 1.10) must keep using `@bentocache/otel@0.1.x`.
