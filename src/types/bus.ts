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
  id: string
  keys: string[]
  type: CacheBusMessageType
}

export interface CacheBusPublisher {
  publish(channel: string, message: CacheBusMessage): Promise<void>
  disconnect(): Promise<void>
}

export interface CacheBusSubscriber {
  subscribe(channel: string, handler: (message: CacheBusMessage) => void): Promise<void>
  unsubscribe(channel: string): Promise<void>
  disconnect(): Promise<void>
}
