/**
 * Message emitted by the cache operation tracing channel.
 *
 * @experimental This API is experimental and may change in future versions.
 */
export interface CacheOperationMessage {
  /**
   * Operation type
   */
  operation: 'get' | 'set' | 'delete' | 'deleteMany' | 'clear' | 'expire'

  /**
   * Cache key with full prefix (e.g., 'users:123' for namespaced keys)
   */
  key?: string

  /**
   * Multiple keys for deleteMany (with full prefix)
   */
  keys?: string[]

  /**
   * Store name
   */
  store: string

  /**
   * Hit or miss (only for 'get')
   */
  hit?: boolean

  /**
   * Which tier served the value: l1, l2 (only for 'get' hits)
   */
  tier?: 'l1' | 'l2'

  /**
   * Value came from grace period (only for 'get')
   */
  graced?: boolean
}
