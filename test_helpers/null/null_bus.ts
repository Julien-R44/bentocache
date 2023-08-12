import type { BusDriver, CacheBusMessage } from '../../src/types/bus.js'

/**
 * A dummy bus driver that does nothing
 */
export class NullBus implements BusDriver {
  setId(_id: string): BusDriver {
    return this
  }

  onReconnect(): void {
    return
  }

  async publish(_channel: string, _message: Omit<CacheBusMessage, 'busId'>) {
    return
  }

  async subscribe(_channel: string, _handler: (message: CacheBusMessage) => void) {
    return
  }

  async unsubscribe(_channel: string) {
    return
  }

  async disconnect() {
    return
  }
}
