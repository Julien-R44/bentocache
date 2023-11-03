export type PromiseOr<T, Async extends boolean> = Async extends true ? Promise<T> : T

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
