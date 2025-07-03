import type { CacheStack } from './cache_stack.js'
import type { CacheEntry } from './cache_entry/cache_entry.js'
import type { GetSetFactoryContext } from '../types/helpers.js'
import type { GetSetHandler } from './get_set/get_set_handler.js'
import { createCacheEntryOptions } from './cache_entry/cache_entry_options.js'

export class TagSystem {
  #getSetHandler!: GetSetHandler
  #kTagPrefix = '___bc:t:'
  #kDeletionTagPrefix = '___bc:d:'

  #expireOptions = createCacheEntryOptions({})
  #getSetTagOptions = createCacheEntryOptions({
    ttl: '10d',
    grace: '10d',
  })

  #getSetDeletionTagOptions = createCacheEntryOptions({
    ttl: '30d',
    grace: '30d',
  })

  constructor(private stack: CacheStack) {}

  setGetSetHandler(handler: GetSetHandler) {
    this.#getSetHandler = handler
  }

  /**
   * Get the cache key for a tag
   */
  getTagCacheKey(tag: string) {
    return this.#kTagPrefix + tag
  }

  /**
   * Get the cache key for a deletion tag
   */
  getDeletionTagCacheKey(tag: string) {
    return this.#kDeletionTagPrefix + tag
  }

  /**
   * Check if a key is a tag key
   */
  isTagKey(key: string) {
    return key.startsWith(this.#kTagPrefix)
  }

  /**
   * Check if a key is a deletion tag key
   */
  isDeletionTagKey(key: string) {
    return key.startsWith(this.#kDeletionTagPrefix)
  }

  /**
   * The GetSet factory when getting a tag from the cache.
   */
  #getTagFactory(ctx: GetSetFactoryContext) {
    const result = ctx.gracedEntry?.value ?? 0
    if (result === 0) ctx.setOptions({ skipBusNotify: true, skipL2Write: true })

    return result
  }

  /**
   * Check if an entry is invalidated by a tag and return true if it is.
   */
  async isTagInvalidated(entry?: CacheEntry) {
    if (!entry) return
    if (this.isTagKey(entry.getKey()) || this.isDeletionTagKey(entry.getKey())) return false

    const tags = entry.getTags()
    if (!tags.length) return false

    for (const tag of tags) {
      const tagExpiration = await this.#getSetHandler.handle(
        this.getTagCacheKey(tag),
        this.#getTagFactory,
        this.#getSetTagOptions.cloneWith({}),
      )

      if (entry.getCreatedAt() <= tagExpiration) {
        await this.stack.expire(entry.getKey(), this.#expireOptions)
        return true
      }
    }
  }

  /**
   * Check if an entry is marked for hard deletion by a tag and return true if it is.
   */
  async isTagHardDeleted(entry?: CacheEntry) {
    if (!entry) return false
    if (this.isTagKey(entry.getKey()) || this.isDeletionTagKey(entry.getKey())) return false

    const tags = entry.getTags()
    if (!tags.length) return false

    for (const tag of tags) {
      const tagDeletionTimestamp = await this.#getSetHandler.handle(
        this.getDeletionTagCacheKey(tag),
        this.#getTagFactory,
        this.#getSetDeletionTagOptions.cloneWith({}),
      )

      // If a deletion timestamp exists and the entry was created before or at it, it's hard deleted
      if (tagDeletionTimestamp > 0 && entry.getCreatedAt() <= tagDeletionTimestamp) {
        return true
      }
    }
    return false
  }

  /**
   * Create invalidation keys for a list of tags
   *
   * We write a `__bc:t:<tag>` key with the current timestamp as value.
   * When we check if a key is invalidated by a tag, we check if the key
   * was created before the tag key value.
   */
  async createTagInvalidations(tags: string[]) {
    const now = Date.now()

    for (const tag of new Set(tags)) {
      const key = this.getTagCacheKey(tag)
      await this.stack.set(key, now, this.#getSetTagOptions)
    }

    return true
  }

  /**
   * Create hard deletion marks for a list of tags.
   * We write a `__bc:d:<tag>` key with the current timestamp as value.
   */
  async createTagDeletionTimestamps(tags: string[]) {
    const now = Date.now()

    for (const tag of new Set(tags)) {
      const key = this.getDeletionTagCacheKey(tag)
      await this.stack.set(key, now, this.#getSetDeletionTagOptions)
    }

    return true
  }
}
