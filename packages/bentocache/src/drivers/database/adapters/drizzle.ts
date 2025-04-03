import type { MySql2Database } from 'drizzle-orm/mysql2'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import { sqliteTable, text as sqliteText, integer } from 'drizzle-orm/sqlite-core'
import { eq, inArray, and, lt, or, isNull, sql as rawSql, gt, like } from 'drizzle-orm'
import { pgTable, text as pgText, timestamp as pgTimestamp } from 'drizzle-orm/pg-core'
import { mysqlTable, text as mysqlText, timestamp as mysqlTimestamp } from 'drizzle-orm/mysql-core'

import { DatabaseDriver } from '../database.js'
import type { CreateDriverResult, DatabaseAdapter } from '../../../types/main.js'

export type DrizzleConnection =
  | NodePgDatabase<Record<string, never>>
  | MySql2Database<any>
  | BetterSQLite3Database<any>

export interface DrizzleConfig {
  connection: DrizzleConnection
  tableName?: string
  dialect?: 'pg' | 'mysql' | 'sqlite'
  prefix?: string
}

export function drizzleDriver(options: DrizzleConfig): CreateDriverResult<DatabaseDriver> {
  return {
    options,
    factory: (config: DrizzleConfig) => {
      const adapter = new DrizzleAdapter(config)
      adapter.createTableIfNotExists()
      return new DatabaseDriver(adapter, config)
    },
  }
}

export class DrizzleAdapter implements DatabaseAdapter {
  #connection: DrizzleConnection
  #tableName: string
  #dialect: 'pg' | 'mysql' | 'sqlite'
  #table: any
  #sqliteClient: any | null = null

  // Function references initialized once based on database type
  #getImpl!: (key: string) => Promise<{ value: string; expiresAt: number | null } | undefined>
  #setImpl!: (row: { key: string; value: string; expiresAt: Date | null }) => Promise<void>
  #deleteImpl!: (key: string) => Promise<boolean>
  #deleteManyImpl!: (keys: string[]) => Promise<number>
  #clearImpl!: (prefix: string) => Promise<void>
  #pruneExpiredEntriesImpl!: () => Promise<void>
  #createTableImpl!: () => Promise<void>

  constructor(config: DrizzleConfig) {
    this.#connection = config.connection
    this.#tableName = config.tableName || '__cache'
    this.#dialect = config.dialect || this.#detectDialect()
    this.#table = this.#createTable()

    // Extract native SQLite client if in SQLite mode
    if (this.#dialect === 'sqlite') {
      this.#sqliteClient = this.#extractSqliteNativeClient()
    }

    // Initialize implementations based on database type
    this.#initImplementations()
  }

  /**
   * Initialize method implementations based on database dialect
   */
  #initImplementations(): void {
    // Initialize get implementation
    if (this.#dialect === 'sqlite' && this.#sqliteClient) {
      this.#getImpl = this.#getSqliteNative
    } else if (this.#dialect === 'sqlite') {
      this.#getImpl = this.#getSqlite
    } else if (this.#dialect === 'mysql') {
      this.#getImpl = this.#getMysql
    } else {
      this.#getImpl = this.#getDefault
    }

    // Initialize set implementation
    if (this.#dialect === 'sqlite' && this.#sqliteClient) {
      this.#setImpl = this.#setSqliteNative
    } else if (this.#dialect === 'sqlite') {
      this.#setImpl = this.#setSqlite
    } else if (this.#dialect === 'mysql') {
      this.#setImpl = this.#setMysql
    } else {
      this.#setImpl = this.#setDefault
    }

    // Initialize delete implementation
    if (this.#dialect === 'mysql') {
      this.#deleteImpl = this.#deleteMysql
    } else {
      this.#deleteImpl = this.#deleteDefault
    }

    // Initialize deleteMany implementation
    if (this.#dialect === 'mysql') {
      this.#deleteManyImpl = this.#deleteManyMysql
    } else {
      this.#deleteManyImpl = this.#deleteManyDefault
    }

    // Initialize clear implementation
    if (this.#dialect === 'sqlite' && this.#sqliteClient) {
      this.#clearImpl = this.#clearSqliteNative
    } else {
      this.#clearImpl = this.#clearDefault
    }

    // Initialize pruneExpiredEntries implementation
    if (this.#dialect === 'sqlite' && this.#sqliteClient) {
      this.#pruneExpiredEntriesImpl = this.#pruneExpiredEntriesSqliteNative
    } else if (this.#dialect === 'sqlite') {
      this.#pruneExpiredEntriesImpl = this.#pruneExpiredEntriesSqlite
    } else {
      this.#pruneExpiredEntriesImpl = this.#pruneExpiredEntriesDefault
    }

    // Initialize createTable implementation
    if (this.#dialect === 'pg') {
      this.#createTableImpl = this.#createTablePg
    } else if (this.#dialect === 'mysql') {
      this.#createTableImpl = this.#createTableMysql
    } else if (this.#dialect === 'sqlite' && this.#sqliteClient) {
      this.#createTableImpl = this.#createTableSqliteNative
    } else {
      this.#createTableImpl = this.#createTableSqlite
    }
  }

  /**
   * Set the table name for the cache
   */
  setTableName(tableName: string): void {
    this.#tableName = tableName
    this.#table = this.#createTable()
  }

  // Public methods, directly calling their specific implementations

  /**
   * Get a value from the cache by key
   */
  async get(key: string): Promise<{ value: string; expiresAt: number | null } | undefined> {
    return this.#getImpl(key)
  }

  /**
   * Delete a value from the cache by key
   */
  async delete(key: string): Promise<boolean> {
    return this.#deleteImpl(key)
  }

  /**
   * Delete multiple values from the cache by keys
   */
  async deleteMany(keys: string[]): Promise<number> {
    return this.#deleteManyImpl(keys)
  }

  /**
   * Disconnect from the database (not required for Drizzle)
   */
  async disconnect(): Promise<void> {
    // No explicit disconnect needed for Drizzle
  }

  /**
   * Create the cache table if it doesn't exist
   */
  async createTableIfNotExists(): Promise<void> {
    return this.#createTableImpl()
  }

  /**
   * Remove expired entries from the cache
   */
  async pruneExpiredEntries(): Promise<void> {
    return this.#pruneExpiredEntriesImpl()
  }

  /**
   * Clear all entries with the given prefix
   */
  async clear(prefix: string): Promise<void> {
    return this.#clearImpl(prefix)
  }

  /**
   * Set a value in the cache
   */
  async set(row: { key: string; value: string; expiresAt: Date | null }): Promise<void> {
    return this.#setImpl(row)
  }

  // Implementation methods for different database dialects

  // --- Get implementations ---

  /**
   * Get implementation using native SQLite client
   */
  async #getSqliteNative(
    key: string,
  ): Promise<{ value: string; expiresAt: number | null } | undefined> {
    const currentTimestamp = new Date().getTime()
    const stmt = this.#sqliteClient.prepare(`
      SELECT key, value, expires_at 
      FROM ${this.#tableName}
      WHERE key = ? AND (expires_at IS NULL OR expires_at > ?)
      LIMIT 1
    `)
    const row = stmt.get(key, currentTimestamp)
    if (!row) return undefined

    return {
      value: row.value,
      expiresAt: row.expires_at,
    }
  }

  /**
   * Get implementation for SQLite using Drizzle ORM
   */
  async #getSqlite(key: string): Promise<{ value: string; expiresAt: number | null } | undefined> {
    const now = new Date().getTime()
    const result = await this.db
      .select()
      .from(this.#table)
      .where(
        and(
          eq(this.#table.key, key),
          or(isNull(this.#table.expiresAt), gt(this.#table.expiresAt, now)),
        ),
      )
      .limit(1)

    if (!result.length) return undefined

    // Ensure SQLite expiresAt is properly converted to a number
    let expiresAt = result[0].expiresAt
    if (expiresAt !== null && typeof expiresAt !== 'number') {
      // Try to convert string to number
      expiresAt = Number(expiresAt)
      if (Number.isNaN(expiresAt)) {
        expiresAt = null
      }
    }

    return {
      value: result[0].value,
      expiresAt,
    }
  }

  /**
   * Get implementation for MySQL using raw SQL
   */
  async #getMysql(key: string): Promise<{ value: string; expiresAt: number | null } | undefined> {
    // Use UNIX_TIMESTAMP to convert dates on the server side
    const result = await this.db.execute(rawSql`
      SELECT 
        \`key\`, 
        \`value\`, 
        \`expires_at\`,
        UNIX_TIMESTAMP(\`expires_at\`) * 1000 as expires_timestamp
      FROM ${rawSql.identifier(this.#tableName)}
      WHERE \`key\` = ${key}
      AND (\`expires_at\` IS NULL OR \`expires_at\` > NOW())
      LIMIT 1
    `)

    // Process MySQL result
    const rows = Array.isArray(result) && result.length === 2 ? result[0] : result

    if (!rows || !rows.length) return undefined

    const row = rows[0]
    return {
      value: row.value,
      // Use server-side timestamp instead of local conversion
      expiresAt: row.expires_timestamp !== null ? Number(row.expires_timestamp) : null,
    }
  }

  /**
   * Default get implementation (PostgreSQL)
   */
  async #getDefault(key: string): Promise<{ value: string; expiresAt: number | null } | undefined> {
    const now = new Date()
    const result = await this.db
      .select()
      .from(this.#table)
      .where(
        and(
          eq(this.#table.key, key),
          or(isNull(this.#table.expiresAt), gt(this.#table.expiresAt, now)),
        ),
      )
      .limit(1)

    if (!result.length) return undefined

    // Ensure consistent expiresAt format across all databases
    let expiresAt = result[0].expiresAt
    if (expiresAt !== null) {
      if (typeof expiresAt === 'number') {
        // Already a number, no conversion needed
      } else if (expiresAt instanceof Date) {
        expiresAt = expiresAt.getTime()
      } else if (typeof expiresAt === 'string') {
        // Try to convert string to number or date
        const numericValue = Number(expiresAt)
        if (!Number.isNaN(numericValue)) {
          expiresAt = numericValue
        } else {
          const dateValue = new Date(expiresAt)
          if (!Number.isNaN(dateValue.getTime())) {
            expiresAt = dateValue.getTime()
          } else {
            expiresAt = null
          }
        }
      } else {
        // Unsupported type, set to null
        expiresAt = null
      }
    }

    return {
      value: result[0].value,
      expiresAt,
    }
  }

  // --- Set implementations ---

  /**
   * Set implementation using native SQLite client
   */
  async #setSqliteNative(row: {
    key: string
    value: string
    expiresAt: Date | null
  }): Promise<void> {
    const expiresAtValue = row.expiresAt ? row.expiresAt.getTime() : null
    const stmt = this.#sqliteClient.prepare(`
      INSERT OR REPLACE INTO ${this.#tableName} (key, value, expires_at)
      VALUES (?, ?, ?)
    `)
    stmt.run(row.key, row.value, expiresAtValue)
  }

  /**
   * Set implementation for SQLite using Drizzle ORM
   */
  async #setSqlite(row: { key: string; value: string; expiresAt: Date | null }): Promise<void> {
    const expiresAtValue = row.expiresAt ? row.expiresAt.getTime() : null

    // First try using onConflictDoUpdate method
    if (typeof this.db.insert === 'function' && typeof this.db.onConflictDoUpdate === 'function') {
      await this.db
        .insert(this.#table)
        .values({
          key: row.key,
          value: row.value,
          expiresAt: expiresAtValue,
        })
        .onConflictDoUpdate({
          target: this.#table.key,
          set: {
            value: row.value,
            expiresAt: expiresAtValue,
          },
        })
      return
    }

    // Check if record exists
    const existing = await this.db
      .select()
      .from(this.#table)
      .where(eq(this.#table.key, row.key))
      .limit(1)

    if (existing && existing.length > 0) {
      // Update
      await this.db
        .update(this.#table)
        .set({
          value: row.value,
          expiresAt: expiresAtValue,
        })
        .where(eq(this.#table.key, row.key))
    } else {
      // Insert
      await this.db.insert(this.#table).values({
        key: row.key,
        value: row.value,
        expiresAt: expiresAtValue,
      })
    }
  }

  /**
   * Set implementation for MySQL using raw SQL
   */
  async #setMysql(row: { key: string; value: string; expiresAt: Date | null }): Promise<void> {
    if (row.expiresAt === null) {
      await this.db.execute(rawSql`
        REPLACE INTO ${rawSql.identifier(this.#tableName)} (
          \`key\`, \`value\`, \`expires_at\`
        ) VALUES (
          ${row.key}, ${row.value}, NULL
        )
      `)
    } else {
      // Use FROM_UNIXTIME to ensure correct timestamp handling
      const timestamp = Math.floor(row.expiresAt.getTime() / 1000)

      await this.db.execute(rawSql`
          REPLACE INTO ${rawSql.identifier(this.#tableName)} (
            \`key\`, \`value\`, \`expires_at\`
          ) VALUES (
            ${row.key}, ${row.value}, FROM_UNIXTIME(${timestamp})
          )
        `)
    }
  }

  /**
   * Default set implementation (PostgreSQL)
   */
  async #setDefault(row: { key: string; value: string; expiresAt: Date | null }): Promise<void> {
    await this.db
      .insert(this.#table)
      .values({
        key: row.key,
        value: row.value,
        expiresAt: row.expiresAt,
      })
      .onConflictDoUpdate({
        target: this.#table.key,
        set: {
          value: row.value,
          expiresAt: row.expiresAt,
        },
      })
  }

  // --- Delete implementations ---

  /**
   * Delete implementation for MySQL with explicit existence check
   */
  async #deleteMysql(key: string): Promise<boolean> {
    // First check if record exists
    const existsResult = await this.db.execute(rawSql`
      SELECT COUNT(*) as count
      FROM ${rawSql.identifier(this.#tableName)}
      WHERE \`key\` = ${key}
      LIMIT 1
    `)

    // Process MySQL result
    const rows =
      Array.isArray(existsResult) && existsResult.length === 2 ? existsResult[0] : existsResult

    const exists = rows && rows.length > 0 && rows[0].count > 0

    // If exists, then delete
    if (exists) {
      await this.db.delete(this.#table).where(eq(this.#table.key, key))
      return true
    }

    return false
  }

  /**
   * Default delete implementation with returning support
   */
  async #deleteDefault(key: string): Promise<boolean> {
    // Some SQLite drivers may not support returning
    if (this.#dialect === 'sqlite') {
      // First check if record exists
      const existingRecord = await this.db
        .select()
        .from(this.#table)
        .where(eq(this.#table.key, key))
        .limit(1)

      // Execute delete operation
      await this.db.delete(this.#table).where(eq(this.#table.key, key))

      // Return whether record was deleted
      return existingRecord.length > 0
    }

    // PostgreSQL and other databases supporting returning
    const result = await this.db.delete(this.#table).where(eq(this.#table.key, key)).returning()
    return result.length > 0
  }

  // --- DeleteMany implementations ---

  /**
   * DeleteMany implementation for MySQL
   */
  async #deleteManyMysql(keys: string[]): Promise<number> {
    // Simply return 0 for empty arrays - this matches other drivers
    if (keys.length === 0) return 0

    const result = await this.db.delete(this.#table).where(inArray(this.#table.key, keys))

    // Return number of affected rows, matching Kysely's implementation
    return typeof result.affectedRows === 'number' ? result.affectedRows : 0
  }

  /**
   * Default deleteMany implementation
   */
  async #deleteManyDefault(keys: string[]): Promise<number> {
    // Simply return 0 for empty arrays - this matches other drivers
    if (keys.length === 0) return 0

    // For PostgreSQL and other databases supporting returning
    if (this.#dialect !== 'sqlite') {
      const result = await this.db
        .delete(this.#table)
        .where(inArray(this.#table.key, keys))
        .returning()

      // Return actual count rather than keys.length
      return result.length
    }

    // For SQLite, we need to do a simpler version
    // SQLite may not support returning in some configurations
    const result = await this.db.delete(this.#table).where(inArray(this.#table.key, keys))

    // Return 0 if no result is available
    return result && typeof result.length === 'number' ? result.length : 0
  }

  // --- Clear implementations ---

  /**
   * Clear implementation using native SQLite client
   */
  async #clearSqliteNative(prefix: string): Promise<void> {
    const stmt = this.#sqliteClient.prepare(`
      DELETE FROM ${this.#tableName}
      WHERE key LIKE ?
    `)
    stmt.run(`${prefix}%`)
  }

  /**
   * Default clear implementation using like operator
   */
  async #clearDefault(prefix: string): Promise<void> {
    await this.db.delete(this.#table).where(like(this.#table.key, `${prefix}%`))
  }

  // --- PruneExpiredEntries implementations ---

  /**
   * PruneExpiredEntries implementation using native SQLite client
   */
  async #pruneExpiredEntriesSqliteNative(): Promise<void> {
    const now = Date.now()
    const stmt = this.#sqliteClient.prepare(`
      DELETE FROM ${this.#tableName}
      WHERE expires_at IS NOT NULL AND expires_at < ?
    `)
    stmt.run(now)
  }

  /**
   * PruneExpiredEntries implementation for SQLite using Drizzle ORM
   */
  async #pruneExpiredEntriesSqlite(): Promise<void> {
    const now = Date.now()
    await this.db
      .delete(this.#table)
      .where(and(gt(this.#table.expiresAt, 0), lt(this.#table.expiresAt, now)))
  }

  /**
   * Default pruneExpiredEntries implementation
   */
  async #pruneExpiredEntriesDefault(): Promise<void> {
    const now = new Date()
    await this.db.delete(this.#table).where(lt(this.#table.expiresAt, now))
  }

  // --- CreateTable implementations ---

  /**
   * Create table implementation for PostgreSQL
   */
  async #createTablePg(): Promise<void> {
    await this.db.execute(rawSql`
      CREATE TABLE IF NOT EXISTS ${rawSql.identifier(this.#tableName)} (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        expires_at TIMESTAMP WITH TIME ZONE
      )
    `)
  }

  /**
   * Create table implementation for MySQL
   */
  async #createTableMysql(): Promise<void> {
    await this.db.execute(rawSql`
      CREATE TABLE IF NOT EXISTS ${rawSql.identifier(this.#tableName)} (
        \`key\` VARCHAR(255) PRIMARY KEY,
        \`value\` TEXT NOT NULL,
        \`expires_at\` TIMESTAMP NULL DEFAULT NULL
      )
    `)
  }

  /**
   * Create table implementation using native SQLite client
   */
  async #createTableSqliteNative(): Promise<void> {
    this.#sqliteClient.exec(`
      CREATE TABLE IF NOT EXISTS ${this.#tableName} (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        expires_at INTEGER
      )
    `)
  }

  /**
   * Create table implementation for SQLite using Drizzle ORM
   */
  async #createTableSqlite(): Promise<void> {
    // Try different methods until finding a working one

    // Try using SQL execution
    if (typeof this.db.execute === 'function') {
      await this.db.execute(rawSql`
        CREATE TABLE IF NOT EXISTS ${rawSql.identifier(this.#tableName)} (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL,
          expires_at INTEGER
        )
      `)
      return
    }

    // Try using run method (supported by some SQLite clients)
    if (typeof this.db.run === 'function') {
      await this.db.run(`
        CREATE TABLE IF NOT EXISTS ${this.#tableName} (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL,
          expires_at INTEGER
        )
      `)
      return
    }

    // Try using schema API
    if (this.db.schema) {
      const hasTable = await this.db.schema.hasTable?.(this.#tableName)
      if (!hasTable) {
        await this.db.schema
          .createTable(this.#tableName)
          .ifNotExists()
          .addColumn('key', 'text', (col: any) => col.primaryKey())
          .addColumn('value', 'text', (col: any) => col.notNull())
          .addColumn('expires_at', 'integer')
          .execute()
      }
      return
    }

    // Finally try using existing table
    await this.db.select().from(this.#table).limit(1)
  }

  /**
   * Get type-safe database connection
   */
  private get db(): any {
    return this.#connection
  }

  /**
   * Detect database dialect from connection object
   */
  #detectDialect(): 'pg' | 'mysql' | 'sqlite' {
    const connConstructor = this.#connection.constructor.name.toLowerCase()

    if (connConstructor.includes('pg') || connConstructor.includes('postgres')) {
      return 'pg'
    } else if (connConstructor.includes('mysql')) {
      return 'mysql'
    } else if (connConstructor.includes('sqlite')) {
      return 'sqlite'
    }

    return 'pg'
  }

  /**
   * Create table schema based on database dialect
   */
  #createTable() {
    switch (this.#dialect) {
      case 'pg':
        return pgTable(this.#tableName, {
          key: pgText('key').primaryKey(),
          value: pgText('value').notNull(),
          expiresAt: pgTimestamp('expires_at', { withTimezone: true }),
        })
      case 'mysql':
        return mysqlTable(this.#tableName, {
          key: mysqlText('key').primaryKey(),
          value: mysqlText('value').notNull(),
          expiresAt: mysqlTimestamp('expires_at'),
        })
      case 'sqlite':
        // Ensure correct column types, use integer for timestamps in SQLite
        return sqliteTable(this.#tableName, {
          key: sqliteText('key').primaryKey(),
          value: sqliteText('value').notNull(),
          expiresAt: integer('expires_at'), // Use plain number
        })
    }
  }

  /**
   * Extract native SQLite client from drizzle-wrapped connection
   */
  #extractSqliteNativeClient(): any {
    const conn = this.#connection

    // Try common paths to find SQLite client
    const possiblePaths = [
      (conn as any)?.driver?.database,
      (conn as any)?.client,
      (conn as any)?.db,
      (conn as any)?.connection,
    ]

    for (const client of possiblePaths) {
      if (client && typeof client.exec === 'function') {
        return client
      }
    }

    return null
  }
}
