import { ChaosInjector } from './chaos_injector.js'
import type { CacheDriver } from '../../src/types/driver.js'

/**
 * ChaosCache is a CacheDriver Wrapper that adds chaos to the cache
 * by randomly throwing errors or delaying the execution of the cache.
 *
 * This is handy for testing the resilience of the cache within
 * our test suite.
 */
export class ChaosCache implements CacheDriver {
  /**
   * The inner cache driver that is wrapped
   */
  #innerCache: CacheDriver

  /**
   * Reference to the chaos injector
   */
  #chaosInjector: ChaosInjector

  constructor(innerCache: CacheDriver) {
    this.#innerCache = innerCache
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
   * Make the cache delay for the given amount of milliseconds
   */
  alwaysDelay(minDelay: number, maxDelay: number) {
    this.#chaosInjector.alwaysDelay(minDelay, maxDelay)
    return this
  }

  /**
   * Below is the list of methods that are proxied to the inner cache
   * with the addition of chaos logic
   */
  namespace(namespace: string) {
    return this.#innerCache.namespace(namespace)
  }

  async get(key: string) {
    await this.#chaosInjector.injectChaos()
    return this.#innerCache.get(key)
  }

  async pull(key: string) {
    await this.#chaosInjector.injectChaos()
    return this.#innerCache.pull(key)
  }

  async set(key: string, value: string, ttl?: number | undefined) {
    await this.#chaosInjector.injectChaos()
    return this.#innerCache.set(key, value, ttl)
  }

  async has(key: string) {
    await this.#chaosInjector.injectChaos()
    return this.#innerCache.has(key)
  }

  async delete(key: string) {
    await this.#chaosInjector.injectChaos()
    return this.#innerCache.delete(key)
  }

  async deleteMany(keys: string[]) {
    await this.#chaosInjector.injectChaos()
    return this.#innerCache.deleteMany(keys)
  }

  async clear() {
    return this.#innerCache.clear()
  }

  async disconnect() {
    return this.#innerCache.disconnect()
  }
}
