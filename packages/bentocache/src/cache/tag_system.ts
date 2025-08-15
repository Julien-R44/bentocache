import type { CacheStack } from './cache_stack.js'
import type { CacheEntry } from './cache_entry/cache_entry.js'
import type { GetSetFactoryContext } from '../types/helpers.js'
import type { GetSetHandler } from './get_set/get_set_handler.js'
import { createCacheEntryOptions } from './cache_entry/cache_entry_options.js'

export class TagSystem {
  #getSetHandler!: GetSetHandler
  #kTagPrefix = '___bc:t:'

  #expireOptions = createCacheEntryOptions({})

  #getSetTagOptions = createCacheEntryOptions({
    ttl: '10d',
    grace: '10d',
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
   * Check if a key is a tag key
   */
  isTagKey(key: string) {
    return key.startsWith(this.#kTagPrefix)
  }

  /**
   * The GetSet factory when getting a tag from the cache.
   * Handles backward compatibility with old schema (timestamp only) and new schema (metadata object).
   */
  #getTagFactory = (ctx: GetSetFactoryContext) => {
    const rawValue = ctx.gracedEntry?.value

    if (this.#isEmptyValue(rawValue)) {
      return this.#createDefaultTagData(ctx)
    }

    if (this.#isLegacySchema(rawValue)) {
      return this.#migrateToObjectSchema(rawValue, ctx)
    }

    if (this.#isValidNewSchema(rawValue)) {
      return this.#processNewSchema(rawValue, ctx)
    }

    return this.#handleUnexpectedData(ctx)
  }

  #isEmptyValue(value: unknown): boolean {
    return value === undefined || value === null
  }

  #isLegacySchema(value: unknown): boolean {
    return typeof value === 'number'
  }

  #isValidNewSchema(value: unknown): boolean {
    return (
      typeof value === 'object' &&
      value !== null &&
      'timestamp' in value &&
      value.timestamp !== undefined &&
      'type' in value &&
      value.type !== undefined
    )
  }

  #createDefaultTagData(ctx: GetSetFactoryContext) {
    const result = { timestamp: 0, type: 'soft' as const }
    ctx.setOptions({ skipBusNotify: true, skipL2Write: true })
    return result
  }

  #migrateToObjectSchema(rawValue: number, ctx: GetSetFactoryContext) {
    const migratedResult = { timestamp: rawValue, type: 'soft' as const }
    ctx.setOptions({
      skipBusNotify: true,
      skipL2Write: false, // Ensure the migrated value is written to L2 cache
    })
    return migratedResult
  }

  #processNewSchema(rawValue: any, ctx: GetSetFactoryContext) {
    const result = rawValue as { timestamp: number; type: 'hard' | 'soft' }
    if (result.timestamp === 0) {
      ctx.setOptions({ skipBusNotify: true, skipL2Write: true })
    }
    return result
  }

  #handleUnexpectedData(ctx: GetSetFactoryContext) {
    const result = { timestamp: 0, type: 'soft' as const }
    ctx.setOptions({ skipBusNotify: true, skipL2Write: true })
    return result
  }

  /**
   * Check both hard deletion and soft invalidation for an entry in a single pass.
   */
  async checkTagValidation(
    entry?: CacheEntry,
  ): Promise<{ isHardDeleted: boolean; isTagInvalidated: boolean }> {
    if (!this.#shouldValidateEntry(entry)) {
      return { isHardDeleted: false, isTagInvalidated: false }
    }

    const tags = entry!.getTags()

    for (const tag of tags) {
      const tagData = await this.#getTagData(tag)
      const validationResult = await this.#validateEntryAgainstTag(entry!, tag, tagData)

      if (validationResult.shouldReturn) {
        return validationResult.result
      }
    }

    return { isHardDeleted: false, isTagInvalidated: false }
  }

  #shouldValidateEntry(entry?: CacheEntry): boolean {
    if (!entry) return false
    if (this.isTagKey(entry.getKey())) return false
    if (!entry.getTags().length) return false
    return true
  }

  async #getTagData(tag: string) {
    return this.#getSetHandler.handle(
      this.getTagCacheKey(tag),
      this.#getTagFactory,
      this.#getSetTagOptions.cloneWith({}),
    )
  }

  async #validateEntryAgainstTag(
    entry: CacheEntry,
    tag: string,
    tagData: any,
  ): Promise<{
    shouldReturn: boolean
    result: { isHardDeleted: boolean; isTagInvalidated: boolean }
  }> {
    // Handle legacy schema data that needs runtime migration
    if (this.#isLegacySchema(tagData)) {
      return this.#handleLegacyTagValidation(entry, tag, tagData)
    }

    // Handle new schema validation
    return this.#handleNewSchemaValidation(entry, tagData)
  }

  async #handleLegacyTagValidation(
    entry: CacheEntry,
    tag: string,
    legacyTimestamp: number,
  ): Promise<{
    shouldReturn: boolean
    result: { isHardDeleted: boolean; isTagInvalidated: boolean }
  }> {
    const migratedData = { timestamp: legacyTimestamp, type: 'soft' as const }

    await this.#writeMigratedTagData(tag, migratedData)

    if (this.#shouldInvalidateEntry(entry, migratedData)) {
      await this.stack.expire(entry.getKey(), this.#expireOptions)
      return {
        shouldReturn: true,
        result: { isHardDeleted: false, isTagInvalidated: true },
      }
    }

    return { shouldReturn: false, result: { isHardDeleted: false, isTagInvalidated: false } }
  }

  async #handleNewSchemaValidation(
    entry: CacheEntry,
    tagData: { timestamp: number; type: 'hard' | 'soft' },
  ): Promise<{
    shouldReturn: boolean
    result: { isHardDeleted: boolean; isTagInvalidated: boolean }
  }> {
    if (this.#shouldHardDelete(entry, tagData)) {
      return {
        shouldReturn: true,
        result: { isHardDeleted: true, isTagInvalidated: false },
      }
    }

    if (this.#shouldInvalidateEntry(entry, tagData)) {
      await this.stack.expire(entry.getKey(), this.#expireOptions)
      return {
        shouldReturn: true,
        result: { isHardDeleted: false, isTagInvalidated: true },
      }
    }

    return { shouldReturn: false, result: { isHardDeleted: false, isTagInvalidated: false } }
  }

  async #writeMigratedTagData(tag: string, migratedData: { timestamp: number; type: 'soft' }) {
    await this.stack.set(
      this.getTagCacheKey(tag),
      migratedData,
      this.#getSetTagOptions.cloneWith({ skipBusNotify: true }),
    )
  }

  #shouldHardDelete(
    entry: CacheEntry,
    tagData: { timestamp: number; type: 'hard' | 'soft' },
  ): boolean {
    return (
      tagData.type === 'hard' && tagData.timestamp > 0 && entry.getCreatedAt() <= tagData.timestamp
    )
  }

  #shouldInvalidateEntry(
    entry: CacheEntry,
    tagData: { timestamp: number; type: 'hard' | 'soft' },
  ): boolean {
    return (
      tagData.type === 'soft' && tagData.timestamp > 0 && entry.getCreatedAt() <= tagData.timestamp
    )
  }

  /**
   * Check if an entry is invalidated by a tag and return true if it is.
   * @deprecated Use checkTagValidation instead for better performance
   */
  async isTagInvalidated(entry?: CacheEntry) {
    const result = await this.checkTagValidation(entry)
    return result.isTagInvalidated
  }

  /**
   * Check if an entry is marked for hard deletion by a tag and return true if it is.
   * @deprecated Use checkTagValidation instead for better performance
   */
  async isTagHardDeleted(entry?: CacheEntry) {
    const result = await this.checkTagValidation(entry)
    return result.isHardDeleted
  }

  /**
   * Create invalidation keys for a list of tags
   *
   * We write a `__bc:t:<tag>` key with metadata containing timestamp and type.
   * When we check if a key is invalidated by a tag, we check if the key
   * was created before the tag key value.
   */
  async createTagInvalidations(tags: string[]) {
    return this.#createTagMarkers(tags, 'soft')
  }

  /**
   * Create hard deletion marks for a list of tags.
   * We write a `__bc:t:<tag>` key with metadata containing timestamp and type.
   */
  async createTagDeletionTimestamps(tags: string[]) {
    return this.#createTagMarkers(tags, 'hard')
  }

  async #createTagMarkers(tags: string[], type: 'soft' | 'hard'): Promise<boolean> {
    const timestamp = Date.now()
    const uniqueTags = this.#getUniqueTags(tags)

    await this.#writeTagMarkers(uniqueTags, timestamp, type)

    return true
  }

  #getUniqueTags(tags: string[]): string[] {
    return [...new Set(tags)]
  }

  async #writeTagMarkers(tags: string[], timestamp: number, type: 'soft' | 'hard'): Promise<void> {
    const tagData = { timestamp, type }

    for (const tag of tags) {
      const key = this.getTagCacheKey(tag)
      await this.stack.set(key, tagData, this.#getSetTagOptions)
    }
  }
}
