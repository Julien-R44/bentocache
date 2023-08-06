import type { CacheDriver } from '../src/types/driver.js'
import type { KeyValueObject } from '../src/types/helpers.js'
import { ChaosUtils } from './chaos_utils.js'

export class ChaosCache implements CacheDriver {
  #innerCache: CacheDriver

  #throwProbability = 0
  #minDelay = 0
  #maxDelay = 0

  constructor(innerCache: CacheDriver) {
    this.#innerCache = innerCache
  }

  alwaysThrow() {
    this.#throwProbability = 1
    return this
  }

  alwaysDelay(minDelay: number, maxDelay: number) {
    this.#minDelay = minDelay
    this.#maxDelay = maxDelay
    return this
  }

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
