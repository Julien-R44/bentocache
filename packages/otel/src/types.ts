import type { CacheOperationMessage } from 'bentocache'
import type { TracingChannelSubscribers } from 'node:diagnostics_channel'
import type { InstrumentationConfig } from '@opentelemetry/instrumentation'

export type CacheOperationChannel = {
  subscribe: (subscribers: TracingChannelSubscribers<CacheOperationMessage>) => void
  unsubscribe: (subscribers: TracingChannelSubscribers<CacheOperationMessage>) => void
}

export type BentoCacheModuleExports = {
  BentoCache?: new (...args: any[]) => any
  tracingChannels?: {
    cacheOperation?: CacheOperationChannel
  }
}

export type CacheKeySanitizer = (key?: string) => string | undefined

export type SpanNameFactory = (message: CacheOperationMessage) => string

export interface BentoCacheInstrumentationConfig extends InstrumentationConfig {
  /**
   * Only create spans when a parent span exists
   * @default true
   */
  requireParentSpan?: boolean

  /**
   * Include cache keys in span attributes
   * @default false
   */
  includeKeys?: boolean

  /**
   * Sanitize cache keys before adding them as attributes
   */
  keySanitizer?: CacheKeySanitizer

  /**
   * Custom span name factory
   */
  spanName?: SpanNameFactory

  /**
   * Prefix used when building the default span name
   * @default 'cache'
   */
  spanNamePrefix?: string

  /**
   * Suppress internal Bentocache operations (L2 + bus)
   * @default true
   */
  suppressInternalOperations?: boolean
}
