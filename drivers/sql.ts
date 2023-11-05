import { Sql } from '../src/drivers/sql.js'
import type { SqlConfig } from '../src/types/options/drivers_options.js'
import type { CreateDriverResult, DialectName } from '../src/types/main.js'

/**
 * Create a new SQLite driver
 * You will need to install the `sqlite3` package
 */
export function sqliteDriver(options: SqlConfig): CreateDriverResult<Sql> {
  return {
    options,
    factory: (config: SqlConfig) => new Sql({ ...config, dialect: 'sqlite3' }),
  }
}

/**
 * Create a new better-sqlite3 driver
 * You will need to install the `better-sqlite3` package
 */
export function betterSqliteDriver(options: SqlConfig): CreateDriverResult<Sql> {
  return {
    options,
    factory: (config: SqlConfig) => new Sql({ ...config, dialect: 'better-sqlite3' }),
  }
}

/**
 * Create a new MySQL driver
 * You will need to install the `mysql2` package
 */
export function mysqlDriver(options: SqlConfig): CreateDriverResult<Sql> {
  return {
    options,
    factory: (config: SqlConfig) => new Sql({ ...config, dialect: 'mysql2' }),
  }
}

/**
 * Create a new PostgreSQL driver
 * You will need to install the `pg` package
 */
export function postgresDriver(options: SqlConfig): CreateDriverResult<Sql> {
  return {
    options,
    factory: (config: SqlConfig) => new Sql({ ...config, dialect: 'pg' }),
  }
}

/**
 * Create a knex driver
 * You will need to install the underlying database package (mysql2, pg, sqlite3, etc)
 */
export function knexDriver(options: SqlConfig & { dialect: DialectName }): CreateDriverResult<Sql> {
  return {
    options,
    factory: (config: SqlConfig) => new Sql({ ...config, dialect: options.dialect }),
  }
}
