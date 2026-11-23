import type { Knex } from 'knex'
import type { Kysely } from 'kysely'
import type { ClientConfig as PgClientConfig } from 'pg'
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
 * Options for the Postgres bus driver
 */
export type PostgresBusConfig = {
  /**
   * A Postgres connection string or `pg` client config. The driver opens
   * two connections from it: one that listens and one that publishes.
   *
   * It must reach the primary, directly or through a proxy, and LISTEN
   * must work on it. A pooler in transaction mode breaks LISTEN unless it
   * supports it explicitly.
   */
  connection: string | PgClientConfig

  /**
   * Maximum time for one publish transaction. A publish that takes longer
   * fails, goes to the retry queue, and the publishing connection is
   * replaced.
   *
   * @default '2s'
   */
  publishTimeout?: Duration

  /**
   * Extra time the driver waits after a message before it sends it, so
   * that more messages share one transaction.
   *
   * Even at `0`, messages published while a transaction runs are sent
   * together in the next one, and messages with the same type and
   * namespace are merged into one notification. Every transaction costs
   * Postgres a transaction id, a WAL record and a cluster-wide lock, so a
   * delay lowers the load on Postgres. BentoCache waits for the publish in
   * every write (`set`, `delete`, `clear`...), so the delay also adds to
   * the latency of each write.
   *
   * @default 0
   */
  batchDelay?: Duration

  /**
   * End-to-end check of the bus. Every `interval`, the driver publishes a
   * message only it listens to and checks that it receives it. If a
   * committed heartbeat isn't received within `timeout`, the listening
   * connection is replaced. It also keeps both connections active, so
   * proxies with an idle timeout longer than `interval` don't close them.
   *
   * Set to `false` to disable it. See the docs for when that is safe.
   *
   * @default { interval: '30s', timeout: '15s' }
   */
  heartbeat?: false | { interval?: Duration; timeout?: Duration }

  /**
   * Called with connection errors, failed publishes and dropped messages.
   * The driver retries on its own, so this is for logging. Without it,
   * errors are logged with `console.error`, each distinct message at most
   * once a minute.
   */
  onError?: (error: Error) => void
}

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
