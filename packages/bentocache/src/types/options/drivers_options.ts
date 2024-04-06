import type { Knex } from 'knex'
import type { Kysely } from 'kysely'
import type { DynamoDBClientConfig } from '@aws-sdk/client-dynamodb'
import type { Redis as IoRedis, RedisOptions as IoRedisOptions } from 'ioredis'

/**
 * Options that are common to all drivers
 *
 * Some of theses options may be also defined in
 * the BentoCache options. Setting them specifically
 * for a driver will override the BentoCache options.
 */
export type DriverCommonOptions = {
  prefix?: string
}

/**
 * Options for DynamoDB driver
 */
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

/**
 * Options for Memory driver
 */
export type MemoryConfig = {
  /**
   * Maximum number of items to store in the cache.
   *
   * Note that fewer items may be stored if you
   * are also using `maxSize` and the cache is full.
   *
   * @default 1000
   */
  maxItems?: number

  /**
   * Maximum size of the cache in bytes.
   */
  maxSize?: number

  /**
   * Maximum size of one entry in bytes.
   *
   * If an entry is larger than this value,
   * it will NOT be stored
   */
  maxEntrySize?: number
} & DriverCommonOptions

/**
 * Options for Redis driver
 */
export type RedisConfig = {
  /**
   * A IoRedis connection instance or connection options
   */
  connection: IoRedis | IoRedisOptions
} & DriverCommonOptions

/**
 * Options for File driver
 */
export type FileConfig = {
  /**
   * Directory where the cache files will be stored
   */
  directory: string
} & DriverCommonOptions

/**
 * Common options for database drivers
 */
export interface DatabaseConfig extends DriverCommonOptions {
  /**
   * Table name to use
   */
  tableName?: string

  /**
   * Should the driver automatically create the table
   * @default true
   */
  autoCreateTable?: boolean

  /**
   * The interval between each expired entry pruning
   * run. Can be set to `false` to disable pruning.
   *
   * @default false
   */
  pruneInterval?: number | false
}

/**
 * Configuration accepted by the Knex adapter
 */
export interface KnexConfig extends DatabaseConfig {
  /**
   * The Knex instance
   */
  connection: Knex
}

/**
 * Configuration accepted by the Kysely adapter
 */
export interface KyselyConfig extends DatabaseConfig {
  /**
   * The Kysely instance
   */
  connection: Kysely<any>
}
