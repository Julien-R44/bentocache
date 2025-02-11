import type { CacheEntry } from '../../cache/cache_entry/cache_entry.js'

export type GetCacheValueReturn = {
  entry: CacheEntry
  isGraced: boolean
}
