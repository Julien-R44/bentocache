import { CacheItem } from './cache_item.js'
import type { CacheOptions } from './cache_options.js'
import type { CacheDriver } from './types/main.js'

export class RemoteCache {
  #driver: CacheDriver

  constructor(driver: CacheDriver) {
    this.#driver = driver
  }

  async get(key: string, options: CacheOptions) {
    let value: undefined | string
    try {
      value = await this.#driver.get(key)

      if (value === undefined) {
        return undefined
      }

      let cacheItem = CacheItem.fromDriver(key, value)

      return cacheItem
    } catch (error) {
      // TODO log error

      if (options.suppressRemoteCacheErrors === false) {
        throw error
      }

      return undefined
    }
  }

  set(key: string, value: string, ttl?: number) {
    try {
      return this.#driver.set(key, value, ttl)
    } catch (error) {
      console.error('RemoteCache.error', key, error)
    }
  }
}
