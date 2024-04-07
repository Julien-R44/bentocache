import type { Transport } from '@rlanz/bus/types/main'

import type { Duration } from './helpers.js'

/**
 * Interface for the bus driver
 */
export type BusDriver = Transport

/**
 * Message sent over the cache bus
 */
export type CacheBusMessage = {
  keys: string[]
  type: CacheBusMessageType
}

export enum CacheBusMessageType {
  /**
   * An item was set in the cache
   */
  Set = 'set',

  /**
   * Whole cache was cleared
   */
  Clear = 'clear',

  /**
   * An item was deleted from the cache
   */
  Delete = 'delete',
}

export type BusOptions = {
  /**
   * Configuration for the bus retry queue
   */
  retryQueue?: {
    /**
     * If we should retry sending messages that failed to be sent
     */
    enabled?: boolean

    /**
     * Maximum number of messages to keep in the retry queue. Older
     * messages will be discarded when the queue is full.
     */
    maxSize?: number

    /**
     * The interval between each retry attempt
     */
    retryInterval?: Duration | false
  }
}
