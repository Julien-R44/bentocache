import { CacheItem } from './cache_item.js'
import type { CacheMethodOptions } from './cache_options.js'
import type { CacheDriver } from './types/main.js'

export class RemoteCache {
  #driver: CacheDriver

  constructor(driver: CacheDriver) {
    this.#driver = driver
  }

  async get(key: string, options: CacheMethodOptions) {
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

  async set(key: string, value: string, options: CacheMethodOptions) {
    try {
      await this.#driver.set(key, value, options.physicalTtl)
    } catch (error) {
      console.error('RemoteCache.error', key, error)
    }
  }

  async delete(key: string, options: CacheMethodOptions) {
    try {
      await this.#driver.delete(key)
    } catch (error) {
      if (options?.suppressRemoteCacheErrors === false) {
        throw error
      }

      return false
    }
  }
}
