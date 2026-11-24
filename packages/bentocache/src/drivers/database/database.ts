import { asyncNoop, once } from '@julr/utils/functions'

import { resolveTtl } from '../../helpers.js'
import { BaseDriver } from '../base_driver.js'
import type { DatabaseConfig, CacheDriver, DatabaseAdapter } from '../../types/main.js'

/**
 * A store that use a database to store cache entries
 *
 * You should provide an adapter that will handle the database interactions
 */
export class DatabaseDriver extends BaseDriver implements CacheDriver<true> {
  type = 'l2' as const

  /**
   * The underlying adapter
   */
  #adapter: DatabaseAdapter

  /**
   * Initialize by creating the table
   */
  #initializer: () => Promise<any>

  /**
   * Pruning interval
   */
  #pruneInterval?: NodeJS.Timeout

  /**
   * Whether a prune run is in progress, so intervals don't overlap
   */
  #pruning = false

  /**
   * Rows deleted per statement while pruning (`0` = single statement)
   */
  #pruneBatchSize: number

  constructor(adapter: DatabaseAdapter, config: DatabaseConfig, isNamespace = false) {
    super(config)
    this.#adapter = adapter
    // `false`/`0` = one statement, like before; batching is opt-in.
    this.#pruneBatchSize = config.pruneBatchSize === false ? 0 : (config.pruneBatchSize ?? 0)

    if (isNamespace) {
      this.#initializer = asyncNoop
      return
    }

    this.#adapter.setTableName(config.tableName || 'bentocache')

    if (config.autoCreateTable !== false) {
      this.#initializer = once(async () => await this.#adapter.createTableIfNotExists())
    } else {
      this.#initializer = asyncNoop
    }

    if (config.pruneInterval === false) return
    this.#startPruneInterval(resolveTtl(config.pruneInterval)!)
  }

  /**
   * Start the interval that will prune expired entries
   * Maybe rework this using a node Worker ?
   */
  #startPruneInterval(interval: number) {
    this.#pruneInterval = setInterval(() => {
      /**
       * A prune that takes longer than the interval would otherwise overlap with
       * the next one, and two prunes deleting the same rows is wasted work. The
       * previous run has to finish (or fail) before the next one starts.
       */
      if (this.#pruning) return

      this.#runPrune().catch(err =>
        console.error('[bentocache] failed to prune expired entries', err),
      )
    }, interval)
  }

  async #runPrune() {
    this.#pruning = true

    try {
      await this.#initializer()
      await this.#pruneExpiredEntries()
    } finally {
      this.#pruning = false
    }
  }

  /**
   * Delete expired entries, in batches when the adapter supports it.
   *
   * A single `delete where expires_at < now()` over a table with millions of rows
   * makes the planner pick a sequential scan and keeps one transaction open for
   * the whole delete — long enough to hit a `statement_timeout`, whose rollback
   * then undoes everything (the table never shrinks, and every run pays the scan
   * again). Deleting `pruneBatchSize` rows per statement bounds each transaction:
   * the batches use the `expires_at` index and stop as soon as one comes back
   * empty. `false`/`0` keeps the single-statement behaviour.
   */
  async #pruneExpiredEntries() {
    const batchSize = this.#pruneBatchSize
    if (!batchSize) {
      await this.#adapter.pruneExpiredEntries()
      return
    }

    /**
     * Nothing left to delete ends the loop; `undefined` means the adapter ignored
     * `limit` and already pruned everything in one call, so there is no batch to
     * repeat.
     */
    for (;;) {
      const deleted = await this.#adapter.pruneExpiredEntries({ limit: batchSize })
      if (!deleted || deleted < batchSize) return
    }
  }

  /**
   * Check if the given timestamp is expired
   */
  #isExpired(expiration: number | null) {
    return expiration !== null && expiration < Date.now()
  }

  /**
   * Returns a new instance of the driver namespaced
   */
  namespace(namespace: string) {
    const store = new (this.constructor as any)(
      this.#adapter,
      { ...this.config, prefix: this.createNamespacePrefix(namespace) },
      true,
    )

    return store
  }

  /**
   * Get a value from the cache
   */
  async get(key: string) {
    await this.#initializer()

    const result = await this.#adapter.get(this.getItemKey(key))
    if (!result) return

    if (this.#isExpired(result.expiresAt)) {
      await this.#adapter.delete(this.getItemKey(key))
      return
    }

    return result.value
  }

  /**
   * Get the value of a key and delete it
   *
   * Returns the value if the key exists, undefined otherwise
   */
  async pull(key: string): Promise<string | undefined> {
    const value = await this.get(key)
    if (value) await this.delete(key)

    return value
  }

  /**
   * Set a value in the cache
   * Returns true if the value was set, false otherwise
   */
  async set(key: string, value: any, ttl?: number) {
    await this.#initializer()
    await this.#adapter.set({
      key: this.getItemKey(key),
      value,
      expiresAt: ttl ? new Date(Date.now() + ttl) : null,
    })

    return true
  }

  /**
   * Remove all items from the cache
   */
  async clear() {
    await this.#initializer()

    await this.#adapter.clear(`${this.prefix}:`)
  }

  /**
   * Delete a key from the cache
   * Returns true if the key was deleted, false otherwise
   */
  async delete(key: string) {
    await this.#initializer()
    return this.#adapter.delete(this.getItemKey(key))
  }

  /**
   * Delete multiple keys from the cache
   */
  async deleteMany(keys: string[]) {
    if (keys.length === 0) return true
    await this.#initializer()

    keys = keys.map(key => this.getItemKey(key))
    const result = await this.#adapter.deleteMany(keys)

    return result > 0
  }

  /**
   * Disconnect from the database
   */
  async disconnect() {
    if (this.#pruneInterval) {
      clearInterval(this.#pruneInterval)
    }

    await this.#adapter.disconnect()
  }

  /**
   * Manually prune expired cache entries.
   */
  async prune() {
    await this.#initializer()
    await this.#pruneExpiredEntries()
  }
}
