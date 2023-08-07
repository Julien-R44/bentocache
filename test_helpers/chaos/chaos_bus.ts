import { ChaosInjector } from './chaos_injector.js'
import type { BusDriver, CacheBusMessage } from '../../src/types/bus.js'

/**
 * ChaosBus is a BusDriver Wrapper that adds chaos to the bus
 * by randomly throwing errors or delaying execution
 *
 * This is handy for testing the resilience of the cache within
 * our test suite.
 */
export class ChaosBus implements BusDriver {
  /**
   * The inner bus driver that is wrapped
   */
  #innerBus: BusDriver

  /**
   * Reference to the chaos injector
   */
  #chaosInjector: ChaosInjector

  constructor(innerBus: BusDriver) {
    this.#innerBus = innerBus
    this.#chaosInjector = new ChaosInjector()
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

  /**
   * Below is the list of methods that are proxied to the inner bus
   * driver with the addition of chaos logic
   */
  async publish(channel: string, message: Omit<CacheBusMessage, 'busId'>): Promise<void> {
    await this.#chaosInjector.injectChaos()
    return this.#innerBus.publish(channel, message)
  }

  async disconnect(): Promise<void> {
    await this.#chaosInjector.injectChaos()
    return this.#innerBus.disconnect()
  }

  async subscribe(channel: string, handler: (message: CacheBusMessage) => void): Promise<void> {
    await this.#chaosInjector.injectChaos()
    return this.#innerBus.subscribe(channel, handler)
  }

  async unsubscribe(channel: string): Promise<void> {
    await this.#chaosInjector.injectChaos()
    return this.#innerBus.unsubscribe(channel)
  }
}
