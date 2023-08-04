/**
 * Represents a cache item stored inside a distributed cache driver.
 */
export class CacheItem {
  /**
   * The value of the item.
   */
  #value: any

  /**
   * The logical expiration is the time in miliseconds when the item
   * will be considered expired. But, if Graceful Retain is enabled,
   * the item will still be available for a while.
   */
  #logicalExpiration: number

  constructor(key: string, item: Record<string, any>) {
    this.#value = item.value
    this.#logicalExpiration = item.logicalExpiration
  }

  getValue() {
    return this.#value
  }

  isLogicallyExpired() {
    return Date.now() >= this.#logicalExpiration
  }

  static fromDriver(key: string, item: Record<string, any>) {
    return new CacheItem(key, item)
  }
}
