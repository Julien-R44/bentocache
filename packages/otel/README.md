# @bentocache/otel

Official OpenTelemetry instrumentation for Bentocache.

## Install

```bash
pnpm add @bentocache/otel
```

## Usage

```ts
import { BentoCacheInstrumentation } from '@bentocache/otel'

const instrumentation = new BentoCacheInstrumentation({
  requireParentSpan: true,
  includeKeys: false,
  suppressInternalOperations: true,
})
```

### Options

- `requireParentSpan` (default: `true`) Only create spans when a parent span exists
- `includeKeys` (default: `false`) Include cache keys in span attributes
- `keySanitizer` Sanitize keys before adding them as attributes
- `spanName` Custom span name factory
- `spanNamePrefix` (default: `cache`) Prefix for default span names
- `suppressInternalOperations` (default: `true`) Suppress internal L2/bus operations
