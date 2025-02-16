import type { CacheSerializer } from '../../types/main.js'

/**
 * Represents a cache entry stored inside a cache driver.
 */
export class CacheEntry {
  /**
   * The key of the cache item.
   */
  #key: string

  /**
   * The value of the item.
   */
  #value: any
  #tags: string[]

  /**
   * The logical expiration is the time in miliseconds when the item
   * will be considered expired. But, if grace period is enabled,
   * the item will still be available for a while.
   */
  #logicalExpiration: number

  /**
   * The time when the item was created.
   */
  #createdAt: number

  #serializer?: CacheSerializer

  constructor(key: string, item: Record<string, any>, serializer?: CacheSerializer) {
    this.#key = key
    this.#value = item.value
    this.#tags = item.tags ?? []
    this.#logicalExpiration = item.logicalExpiration
    this.#serializer = serializer
    this.#createdAt = item.createdAt
  }

  getValue() {
    return this.#value
  }

  getKey() {
    return this.#key
  }

  getCreatedAt() {
    return this.#createdAt
  }

  getLogicalExpiration() {
    return this.#logicalExpiration
  }

  getTags() {
    return this.#tags
  }

  isLogicallyExpired() {
    return Date.now() >= this.#logicalExpiration
  }

  static fromDriver(key: string, item: string | Record<string, any>, serializer?: CacheSerializer) {
    if (!serializer && typeof item !== 'string') return new CacheEntry(key, item, serializer)

    return new CacheEntry(key, serializer!.deserialize(item) ?? item, serializer)
  }

  applyBackoff(duration: number) {
    this.#logicalExpiration += duration
    return this
  }

  expire() {
    this.#logicalExpiration = Date.now() - 100
    return this
  }

  serialize() {
    const raw = {
      value: this.#value,
      createdAt: this.#createdAt,
      logicalExpiration: this.#logicalExpiration,
      ...(this.#tags.length > 0 && { tags: this.#tags }),
    }

    if (this.#serializer) return this.#serializer.serialize(raw)
    return raw
  }
}
