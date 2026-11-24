import type { Knex } from 'knex'
import type { Kysely } from 'kysely'
import type { DynamoDBClientConfig } from '@aws-sdk/client-dynamodb'
import type { DbResult, DefaultColumnTypes, DefaultSchemaConfig } from 'orchid-orm'
import type {
  Redis as IoRedis,
  RedisOptions as IoRedisOptions,
  Cluster as IoRedisCluster,
} from 'ioredis'

import type { Logger } from '../../logger.js'
import type { Duration } from '../helpers.js'

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

export type DriverCommonInternalOptions = {
  logger?: Logger
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
 * A number of bytes
 * Can be represented as a number or a string
 * e.g. '1kb', '1mb', '1gb'
 * We use https://www.npmjs.com/package/bytes under the hood
 */
export type Bytes = number | string

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
  maxSize?: Bytes

  /**
   * Maximum size of one entry in bytes.
   *
   * If an entry is larger than this value,
   * it will NOT be stored
   */
  maxEntrySize?: Bytes

  /**
   * Should the entries be serialized before storing
   * them in the cache.
   *
   * Note that, if unset, you cannot use maxSize or maxEntrySize
   * since the size of deserialized objects cannot be calculated.
   *
   * **Also make sure to read the below documentation. This option
   * can cause issues if not used correctly.**
   *
   * @see http://bentocache.dev/docs/cache-drivers#serialize-option
   * @default true
   */
  serialize?: boolean
} & DriverCommonOptions

/**
 * Options for Redis driver
 */
export type RedisConfig = {
  /**
   * A IoRedis connection instance (Redis or Cluster) or connection options
   */
  connection: IoRedis | IoRedisCluster | IoRedisOptions
} & DriverCommonOptions

/**
 * Options for File driver
 */
export type FileConfig = {
  /**
   * Directory where the cache files will be stored
   */
  directory: string

  /**
   * The interval between each expired entry pruning
   * Can be set to `false` to disable pruning.
   *
   * @default false
   */
  pruneInterval?: Duration | false
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
  pruneInterval?: Duration | false

  /**
   * How many expired entries are deleted per statement during a prune run.
   *
   * One `delete ... where expires_at < now()` over a large table makes the
   * planner choose a sequential scan and hold a single transaction open for
   * the whole delete. On a cache table that grows to millions of rows, that
   * statement can outlive the connection's `statement_timeout`, and the
   * rollback then throws away the work that had already been done — the table
   * never shrinks while each run keeps paying a full scan of it.
   *
   * Pruning therefore deletes in batches of this size, one statement each,
   * until a batch comes back empty.
   *
   * Off by default: pruning in a single statement is what every adapter did
   * before, and the batched form relies on a `delete … where key in (select …)`
   * subquery, which MySQL rejects when the subquery reads the table being
   * deleted from. Turn it on for a big Postgres table, where the single
   * statement is what becomes a problem.
   *
   * @default false
   */
  pruneBatchSize?: number | false
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

/**
 * Configuration accepted by the Orchid ORM adapter
 */
export interface OrchidConfig extends DatabaseConfig {
  /**
   * The Orchid ORM instance
   */
  connection: DbResult<DefaultColumnTypes<DefaultSchemaConfig>>
}
