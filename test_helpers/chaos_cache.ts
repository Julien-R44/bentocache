import { ChaosUtils } from './chaos_utils.js'
import type { CacheDriver } from '../src/types/driver.js'
import type { KeyValueObject } from '../src/types/helpers.js'

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
   * Probability of throwing an error
   */
  #throwProbability = 0

  /**
   * Minimum delay in milliseconds
   */
  #minDelay = 0

  /**
   * Maximum delay in milliseconds
   */
  #maxDelay = 0

  constructor(innerCache: CacheDriver) {
    this.#innerCache = innerCache
  }

  /**
   * Make the cache always throw an error
   */
  alwaysThrow() {
    this.#throwProbability = 1
    return this
  }

  /**
   * Reset the cache to never throw an error
   */
  neverThrow() {
    this.#throwProbability = 0
    return this
  }

  /**
   * Make the cache delay for the given amount of milliseconds
   */
  alwaysDelay(minDelay: number, maxDelay: number) {
    this.#minDelay = minDelay
    this.#maxDelay = maxDelay
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
    await ChaosUtils.maybeApplyChaos(this.#throwProbability, this.#minDelay, this.#maxDelay)
    return this.#innerCache.get(key)
  }

  async getMany(keys: string[]) {
    await ChaosUtils.maybeApplyChaos(this.#throwProbability, this.#minDelay, this.#maxDelay)
    return this.#innerCache.getMany(keys)
  }

  async pull(key: string) {
    await ChaosUtils.maybeApplyChaos(this.#throwProbability, this.#minDelay, this.#maxDelay)
    return this.#innerCache.pull(key)
  }

  async set(key: string, value: string, ttl?: number | undefined) {
    await ChaosUtils.maybeApplyChaos(this.#throwProbability, this.#minDelay, this.#maxDelay)
    return this.#innerCache.set(key, value, ttl)
  }

  async setMany(values: KeyValueObject[], ttl?: number | undefined) {
    await ChaosUtils.maybeApplyChaos(this.#throwProbability, this.#minDelay, this.#maxDelay)
    return this.#innerCache.setMany(values, ttl)
  }

  async has(key: string) {
    await ChaosUtils.maybeApplyChaos(this.#throwProbability, this.#minDelay, this.#maxDelay)
    return this.#innerCache.has(key)
  }

  async delete(key: string) {
    await ChaosUtils.maybeApplyChaos(this.#throwProbability, this.#minDelay, this.#maxDelay)
    return this.#innerCache.delete(key)
  }

  async deleteMany(keys: string[]) {
    await ChaosUtils.maybeApplyChaos(this.#throwProbability, this.#minDelay, this.#maxDelay)
    return this.#innerCache.deleteMany(keys)
  }

  async clear() {
    return this.#innerCache.clear()
  }

  async disconnect() {
    return this.#innerCache.disconnect()
  }
}
