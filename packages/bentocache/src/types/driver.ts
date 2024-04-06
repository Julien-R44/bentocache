type PromiseOr<T, Async extends boolean> = Async extends true ? Promise<T> : T

export interface CacheDriver<Async extends boolean = true> {
  /**
   * Returns a new instance of the driver namespace
   */
  namespace(namespace: string): CacheDriver<Async>

  /**
   * Get a value from the cache
   */
  get(key: string): PromiseOr<string | undefined, Async>

  /**
   * Get the value of a key and delete it
   *
   * Returns the value if the key exists, undefined otherwise
   */
  pull(key: string): PromiseOr<string | undefined, Async>

  /**
   * Put a value in the cache.
   * If `ttl` is not defined, the value will be stored forever
   * Returns true if the value was set, false otherwise
   */
  set(key: string, value: string, ttl?: number): PromiseOr<boolean, Async>

  /**
   * Check if a key exists in the cache
   */
  has(key: string): PromiseOr<boolean, Async>

  /**
   * Remove all items from the cache
   */
  clear(): PromiseOr<void, Async>

  /**
   * Delete a key from the cache
   * Returns true if the key was deleted, false otherwise
   */
  delete(key: string): PromiseOr<boolean, Async>

  /**
   * Delete multiple keys from the cache
   */
  deleteMany(keys: string[]): PromiseOr<boolean, Async>

  /**
   * Closes the connection to the cache.
   * Some drivers may not need this
   */
  disconnect(): PromiseOr<void, Async>
}

/**
 * Interface for a DatabaseAdapter that can be used with the DatabaseDriver
 */
export interface DatabaseAdapter {
  /**
   * Set the table name for the adapter
   */
  setTableName(tableName: string): void

  /**
   * Get an entry from the database
   */
  get(key: string): Promise<{ value: any; expiresAt: number | null } | undefined>

  /**
   * Delete an entry from the database
   *
   * You should return true if the entry was deleted, false otherwise
   */
  delete(key: string): Promise<boolean>

  /**
   * Delete multiple entries from the database
   *
   * Should return the number of entries deleted
   */
  deleteMany(keys: string[]): Promise<number>

  /**
   * Disconnect from the database
   */
  disconnect(): Promise<void>

  /**
   * Create the cache table if it doesn't exist
   *
   * This method is responsible for checking it the table
   * exists before creating it
   */
  createTableIfNotExists(): Promise<void>

  /**
   * Remove expired entries from the cache table
   */
  pruneExpiredEntries(): Promise<void>

  /**
   * Clear all entries from the cache table
   */
  clear(prefix: string): Promise<void>

  /**
   * Set a value in the cache
   * You should also make sure to not create duplicate entries for the same key.
   * Make sure to use `ON CONFLICT` or similar
   */
  set(row: { key: string; value: any; expiresAt: Date | null }): Promise<void>
}
