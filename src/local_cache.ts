import type { CacheMethodOptions } from './cache_options.js'
import type { CacheDriver } from './types/driver.js'

export class LocalCache {
  #driver: CacheDriver

  constructor(driver: CacheDriver) {
    this.#driver = driver
  }

  async get(key: string, options: CacheMethodOptions) {}

  async delete(key: string, options?: CacheMethodOptions) {
    await this.#driver.delete(key)
  }
}
