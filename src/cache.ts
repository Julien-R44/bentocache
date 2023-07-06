import { CacheDriverContract, CachedValue } from "./types/main.js"

export class Cache implements CacheDriverContract {
  #driver: CacheDriverContract

  constructor(driver: CacheDriverContract) {
    this.#driver = driver
  }

  has(key: string): Promise<boolean> {
    return this.#driver.has(key)
  }

  get<T extends CachedValue>(key: string): Promise<T | null> {
    return this.#driver.get(key)
  }

  put<T extends CachedValue>(key: string, value: T, ttl?: number) {
    return this.#driver.put(key, value, ttl)
  }

  clear() {
    return this.#driver.clear()
  }

  disconnect() {
    return this.#driver.disconnect()
  }
}
