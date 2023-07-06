import { File } from "../drivers/file.js"
import { Memcache } from "../drivers/memcache.js"
import { Redis } from "../drivers/redis.js"
import { Memory } from "../drivers/memory.js"
import { CacheManager } from "../cache_manager.js"

export type CacheDriverFactory = (config: any) => CacheDriverContract

export interface CacheDriverContract {
  /**
   * Get a value from the cache
   */
  get<T extends CachedValue>(key: string): Promise<T | null>

  /**
   * Put a value in the cache
   */
  put<T extends CachedValue>(key: string, value: T, ttl?: number): Promise<void>

  /**
   * Check if a key exists in the cache
   */
  has(key: string): Promise<boolean>

  /**
   * Remove all items from the cache
   */
  clear(): Promise<void>

  /**
   * Closes the connection to the cache.
   * Some drivers may not need this
   */
  disconnect(): Promise<void>
}

export type CachedValue = string | number | boolean | null


/**
 * A list of known Caches inferred from the user config
 */
export interface CachesList {}
export type InferCaches<T extends { list: Record<string, CacheDriverFactory> }> = T['list']


export interface CacheDriversList {
  file: (config: FileConfig) => File,
  memcache: (config: MemcacheConfig) => Memcache,
  redis: (config: RedisConfig) => Redis,
  memory: (config: MemoryConfig) => Memory
}

export type CacheDriversListContract = Record<string, CacheDriverFactory>


export interface CacheService
  extends CacheManager<CachesList extends CacheDriversListContract ? CachesList : never> {}

/**
 * Drivers types
 */

export type CommonOptions = {
  /**
   * Default TTL. Can be overridden by specifying a TTL on .set()
   */
  ttl?: number
}

export type FileConfig = {
  filename?: string
  writeDelay?: number,
  expiredCheckDelay?: number,
} & CommonOptions

export type MemcacheConfig = {
  // TODO
} & CommonOptions

export type RedisConfig = {
  // TODO
} & CommonOptions

export type MemoryConfig = {
  // TODO
} & CommonOptions
