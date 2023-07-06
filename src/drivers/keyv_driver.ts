import Keyv, { Store } from "keyv"
import { CacheDriverContract, CachedValue } from "../types/main.js"

export abstract class KeyvDriver implements CacheDriverContract {
  /**
   * Reference to the Keyv instance
   */
  protected keyv!: Keyv

  /**
   * Reference to the Keyv store
   */
  protected store!: Store<any>

  /**
   * Get a value from the cache
   */
  async get<T extends CachedValue>(key: string, defaultValue?: (() => T | Promise<T>) | T): Promise<T | null> {
    const cached = await this.keyv.get(key)
    if (cached) {
      return cached
    }

    if (!defaultValue) {
      return null
    }

    if (typeof defaultValue === 'function') {
      const value = await defaultValue()
      await this.put(key, value)
      return value
    }

    return defaultValue
  }

  /**
   * Put value inside the cache
   */
  async put<T extends CachedValue>(key: string, value: T, ttl?: number | undefined): Promise<void> {
    await this.keyv.set(key, value, ttl)
  }

  /**
   * Clear all values from the cache
   */
  async clear(): Promise<void> {
    await this.keyv.clear()
  }

  /**
   * Check if value exists in the cache
   */
  async has(key: string): Promise<boolean> {
    return await this.keyv.has(key)
  }

  /**
   * Increment value of the given key in the cache
   *
   * Note: this method is not atomic, so it may be overridden by drivers that
   * support atomic decrement.
   */
  async increment(key: string, value = 1): Promise<number> {
    const currentValue = await this.get<number>(key)
    if (currentValue) {
      await this.put(key, currentValue + value)
      return currentValue + value
    }

    await this.put(key, value)
    return value
  }

  /**
   * Decrement value of the given key in the cache
   *
   * Note: This method is not atomic, so it may be overridden by drivers that
   * support atomic decrement.
   */
  async decrement(key: string, value = 1): Promise<number> {
    const currentValue = await this.get<number>(key)
    if (currentValue) {
      await this.put(key, currentValue - value)
      return currentValue - value
    }

    await this.put(key, -value)
    return -value
  }

  /**
   * Disconnect from the cache
   */
  async disconnect(): Promise<void> {
    await this.keyv.disconnect()
  }
}
