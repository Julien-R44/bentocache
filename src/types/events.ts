import type { BusMessagePublished } from '../events/bus_message_published.js'
import type { CacheCleared } from '../events/cache_cleared.js'
import type { CacheDeleted } from '../events/cache_deleted.js'
import type { CacheHit } from '../events/cache_hit.js'
import type { CacheMiss } from '../events/cache_miss.js'
import type { CacheWritten } from '../events/cache_written.js'

/**
 * Shape of the emitter accepted by BentoCache
 * Should be compatible with node's EventEmitter and Emittery
 */
export interface Emitter {
  on: (event: string, callback: (...values: any[]) => void) => void
  once: (event: string, callback: (...values: any[]) => void) => void
  off: (event: string, callback: (...values: any[]) => void) => void
  emit: (event: string, ...values: any[]) => void
}

/**
 * Name/payload of the events emitted by the cache emitter
 */
export type CacheEvents = {
  'cache:cleared': ReturnType<CacheCleared['toJSON']>
  'cache:deleted': ReturnType<CacheDeleted['toJSON']>
  'cache:hit': ReturnType<CacheHit['toJSON']>
  'cache:miss': ReturnType<CacheMiss['toJSON']>
  'cache:written': ReturnType<CacheWritten['toJSON']>
  'bus:message:published': ReturnType<BusMessagePublished['toJSON']>
  'bus:message:received': ReturnType<BusMessagePublished['toJSON']>
}

/**
 * A cache event
 */
export interface CacheEvent {
  name: keyof CacheEvents
  toJSON: () => Record<string, any>
}
