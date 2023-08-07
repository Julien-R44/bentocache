export enum CacheBusMessageType {
  /**
   * An item was set in the cache
   */
  Set = 'set',

  /**
   * An item was deleted from the cache
   */
  Delete = 'delete',
}

export interface CacheBusMessage {
  busId: string
  keys: string[]
  type: CacheBusMessageType
}

export interface BusDriver {
  publish(channel: string, message: Omit<CacheBusMessage, 'busId'>): Promise<void>
  subscribe(channel: string, handler: (message: CacheBusMessage) => void): Promise<void>
  unsubscribe(channel: string): Promise<void>
  disconnect(): Promise<void>
}
