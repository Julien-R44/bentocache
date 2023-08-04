/*
 * @adonisjs/cache
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import type { Redis } from '../drivers/redis.js'
import type { Memory } from '../drivers/memory.js'
import type { CacheManager } from '../cache_manager.js'
import type { Redis as IoRedis, RedisOptions as IoRedisOptions } from 'ioredis'
import type { DynamoDBClientConfig } from '@aws-sdk/client-dynamodb'
import type { File } from '../drivers/file.js'
import type { DynamoDB } from '../drivers/dynamodb.js'
import type { CloudflareKv } from '../drivers/cloudflare_kv.js'

export * from './events.js'

export type GetOrSetCallback = () => MaybePromise<CachedValue>
type MaybePromise<T> = T | Promise<T>

export type GracefulRetainOptions = {
  enabled: boolean
  duration?: TTL
  delay?: TTL
}

export type GetOrSetOptions = {
  gracefulRetain?: GracefulRetainOptions
}

export type CacheDriverFactory = (config: any) => CacheDriver

export type CacheDriverOptions = {
  ttl?: TTL
  prefix?: string
}

export type CreateDriverResult = {
  options: CacheDriverOptions
  driver: CacheDriverFactory
}

export interface CacheSerializer {
  serialize: (value: any) => Promise<string> | string
  deserialize: (value: any) => Promise<any> | any
}

export interface CacheCompresser {
  compress: (value: string) => Promise<string>
  decompress: (value: string) => Promise<string>
}

export type KeyValueObject = { key: string; value: string | undefined }

export interface CacheDriver {
  /**
   * Returns a new instance of the driver namespaced
   */
  namespace(namespace: string): CacheDriver

  /**
   * Get a value from the cache
   */
  get(key: string): MaybePromise<string | undefined>

  /**
   * Get many values from the cache
   * Will return an array of objects with `key` and `value` properties
   * If a value is not found, `value` will be undefined
   */
  getMany(keys: string[]): MaybePromise<KeyValueObject[]>

  /**
   * Get the value of a key and delete it
   *
   * Returns the value if the key exists, undefined otherwise
   */
  pull(key: string): MaybePromise<string | undefined>

  /**
   * Put a value in the cache.
   * If `ttl` is not defined, the value will be stored forever
   * Returns true if the value was set, false otherwise
   */
  set(key: string, value: string, ttl?: number): MaybePromise<boolean>

  /**
   * Set many values in the cache
   * If `ttl` is not defined, the value will be stored forever
   */
  setMany(values: KeyValueObject[], ttl?: number): MaybePromise<boolean>

  /**
   * Check if a key exists in the cache
   */
  has(key: string): MaybePromise<boolean>

  /**
   * Remove all items from the cache
   */
  clear(): MaybePromise<void>

  /**
   * Delete a key from the cache
   * Returns true if the key was deleted, false otherwise
   */
  delete(key: string): MaybePromise<boolean>

  /**
   * Delete multiple keys from the cache
   */
  deleteMany(keys: string[]): MaybePromise<boolean>

  /**
   * Closes the connection to the cache.
   * Some drivers may not need this
   */
  disconnect(): MaybePromise<void>
}

export type CachedValue = any

/**
 * A list of known Caches inferred from the user config
 */
export interface CachesList {}
export type InferCaches<T extends { list: Record<string, CreateDriverResult> }> = T['list']

export interface CacheDriversList {
  file: (config: FileConfig) => File
  redis: (config: RedisConfig) => Redis
  memory: (config: MemoryConfig) => Memory
  dynamodb: (config: DynamoDBConfig) => DynamoDB
  cloudflarekv: (config: CloudflareKvConfig) => CloudflareKv
}

export type CacheDriversListContract = Record<string, CreateDriverResult>

export interface CacheService
  extends CacheManager<CachesList extends CacheDriversListContract ? CachesList : never> {}

/**
 * A TTL can be a number in milliseconds or a string formatted as a duration
 *
 * Formats accepted are :
 * - Simple number in milliseconds
 * - String formatted as a duration. Uses https://github.com/lukeed/ms under the hood
 */
export type TTL = number | string

export type CommonOptions = {
  /**
   * Default TTL
   */
  ttl?: TTL

  /**
   * Prefix to use for all keys
   */
  prefix?: string
}

export type DriverCommonOptions = {
  ttl?: number
  prefix?: string
}

export type FileConfig = {
  /**
   * Directory where the cache files will be stored
   */
  directory: string
} & DriverCommonOptions

export type RedisConfig = {
  /**
   * A IoRedis connection instance or connection options
   */
  connection: IoRedis | IoRedisOptions
} & DriverCommonOptions

export type MemoryConfig = {
  /**
   * Maximum number of items to store in the cache
   * before removing the least recently used items
   *
   * @default 1000
   */
  maxSize?: number
} & DriverCommonOptions

export type DynamoDBConfig = {
  /**
   * DynamoDB table name to use.
   */
  table: {
    name: string
  }

  /**
   * AWS credentials
   */
  credentials?: DynamoDBClientConfig['credentials']

  /**
   * Region of your DynamoDB instance
   */
  region: DynamoDBClientConfig['region']

  /**
   * Endpoint to your DynamoDB instance
   */
  endpoint: DynamoDBClientConfig['endpoint']
} & DriverCommonOptions

export type CloudflareKvConfig = {
  /**
   * Cloudflare account ID
   */
  accountId: string

  /**
   * Your Cloudflare KV namespace ID
   */
  namespaceId: string

  /**
   * API token from https://dash.cloudflare.com/profile/api-tokens
   */
  apiToken: string

  /**
   * Should the driver not throw an error when the minimum
   * TTL is not respected ( 60 seconds )
   */
  ignoreMinTtlError?: boolean
} & DriverCommonOptions
