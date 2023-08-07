import { CacheItem } from './cache_item.js'
import type { CacheMethodOptions } from './cache_options.js'
import type { CacheDriver } from './types/driver.js'

export class LocalCache {
  #driver: CacheDriver

  constructor(driver: CacheDriver) {
    this.#driver = driver
  }

  async get(key: string, options: CacheMethodOptions) {
    let value: undefined | string

    value = await this.#driver.get(key)

    if (value === undefined) {
      return undefined
    }

    let cacheItem = CacheItem.fromDriver(key, value)

    return cacheItem
  }

  async set(key: string, value: string, options: CacheMethodOptions) {
    // todo: 		// IF FAIL-SAFE IS DISABLED AND DURATION IS <= ZERO -> REMOVE ENTRY (WILL SAVE RESOURCES)

    await this.#driver.set(key, value, options.physicalTtl)
  }

  async delete(key: string, options?: CacheMethodOptions) {
    await this.#driver.delete(key)
  }
}
