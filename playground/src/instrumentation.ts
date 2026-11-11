import { register } from 'node:module'
import { NodeSDK } from '@opentelemetry/sdk-node'
import { BentoCacheInstrumentation } from '@bentocache/otel'
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http'

/**
 * Lets @opentelemetry/instrumentation patch ESM modules such as bentocache
 */
register('@opentelemetry/instrumentation/hook.mjs', import.meta.url)

const sdk = new NodeSDK({
  serviceName: 'bentocache-playground',
  traceExporter: new OTLPTraceExporter({ url: 'http://localhost:4318/v1/traces' }),
  instrumentations: [
    new BentoCacheInstrumentation({ requireParentSpan: false, includeKeys: true }),
  ],
})

sdk.start()
