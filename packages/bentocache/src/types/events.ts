import type { busEvents } from '../events/bus_events.js'
import type { cacheEvents } from '../events/cache_events.js'

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
  'cache:cleared': ReturnType<typeof cacheEvents.cleared>['data']
  'cache:deleted': ReturnType<typeof cacheEvents.deleted>['data']
  'cache:hit': ReturnType<typeof cacheEvents.hit>['data']
  'cache:miss': ReturnType<typeof cacheEvents.miss>['data']
  'cache:written': ReturnType<typeof cacheEvents.written>['data']
  'bus:message:published': ReturnType<typeof busEvents.messagePublished>['data']
  'bus:message:received': ReturnType<typeof busEvents.messageReceived>['data']
}

/**
 * A cache event
 */
export interface CacheEvent {
  name: keyof CacheEvents
  data: Record<string, any>
}
