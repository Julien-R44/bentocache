---
'bentocache': minor
---

Add experimental support for Node.js Diagnostic Channels (TracingChannel) for cache operations instrumentation.

This enables APM tools and OpenTelemetry to trace cache operations with timing information:

```ts
import { tracingChannels } from 'bentocache'

tracingChannels.cacheOperation.start.subscribe((message) => {
  console.log(`Starting ${message.operation} on ${message.key}`)
})

tracingChannels.cacheOperation.asyncEnd.subscribe((message) => {
  console.log(`Completed with hit=${message.hit}, tier=${message.tier}`)
})
```

Traced operations: `get`, `set`, `delete`, `deleteMany`, `clear`, `expire`, and `getOrSet` (as get + set on miss).
