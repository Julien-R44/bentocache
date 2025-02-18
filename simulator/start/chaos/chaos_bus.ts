import type { Serializable, SubscribeHandler, Transport } from '@boringnode/bus/types/main'

import { ChaosInjector } from './chaos_injector.js'

interface BusMessage {
  channel: string
  message: Serializable
  busId: string
  timestamp: number
}

export class ChaosBus implements Transport {
  /**
   * The inner transport driver that is wrapped
   */
  readonly #innerTransport: Transport

  /**
   * Reference to the chaos injector
   */
  #chaosInjector: ChaosInjector
  id!: string

  sentMessages: Array<BusMessage> = []
  receivedMessages: Array<BusMessage> = []

  constructor(innerTransport: Transport) {
    this.#innerTransport = innerTransport
    this.#chaosInjector = new ChaosInjector()
  }

  setId(id: string) {
    this.#innerTransport.setId(id)
    this.id = id

    return this.#innerTransport
  }

  getInnerTransport<T extends Transport>(): T {
    return this.#innerTransport as T
  }

  /**
   * Make the cache always throw an error
   */
  alwaysThrow() {
    this.#chaosInjector.alwaysThrow()
    return this
  }

  /**
   * Reset the cache to never throw an error
   */
  neverThrow() {
    this.#chaosInjector.neverThrow()
    return this
  }

  async publish(channel: string, message: Serializable) {
    await this.#chaosInjector.injectChaos()
    this.sentMessages.push({
      channel,
      message,
      busId: this.id,
      timestamp: Date.now(),
    })
    return this.#innerTransport.publish(channel, message)
  }

  async subscribe<T extends Serializable>(channel: string, handler: SubscribeHandler<T>) {
    return this.#innerTransport.subscribe(channel, (message) => {
      this.receivedMessages.push({
        channel,
        message,
        busId: this.id,
        timestamp: Date.now(),
      })
      return handler(message as any)
    })
  }

  unsubscribe(channel: string) {
    return this.#innerTransport.unsubscribe(channel)
  }

  disconnect() {
    return this.#innerTransport.disconnect()
  }

  onReconnect(_callback: () => void): void {}
}
