import { dirname, join } from 'node:path'
import { Worker } from 'node:worker_threads'
import { access, mkdir, readFile, writeFile, rm } from 'node:fs/promises'

import { Locks } from '../../cache/locks.js'
import { resolveTtl } from '../../helpers.js'
import { BaseDriver } from '../base_driver.js'
import type {
  CacheDriver,
  CreateDriverResult,
  DriverCommonInternalOptions,
  FileConfig,
} from '../../types/main.js'

/**
 * Create a new file driver
 */
export function fileDriver(options: FileConfig): CreateDriverResult<FileDriver> {
  return {
    options,
    factory: (config: FileConfig & DriverCommonInternalOptions) => new FileDriver(config),
  }
}

/**
 * Caching driver for the filesystem
 *
 * - Each key is stored as a file in the filesystem.
 * - Each namespace is a folder created in the parent namespace
 * - Files are stored in the following format: [stringifiedValue, expireTimestamp]
 * - If the expireTimestamp is -1, the value should never expire
 */
export class FileDriver extends BaseDriver implements CacheDriver {
  type = 'l2' as const

  /**
   * Root directory for storing the cache files
   */
  #directory: string

  /**
   * Worker thread that will clean up the expired files
   */
  #cleanerWorker?: Worker
  #locks = new Locks()

  declare config: FileConfig & DriverCommonInternalOptions

  constructor(config: FileConfig, isNamespace: boolean = false) {
    super(config)

    this.#directory = this.#sanitizePath(join(config.directory, config.prefix || ''))

    /**
     * If this is a namespaced class, then we should not start the cleaner
     * worker multiple times. Only the parent class will take care of it.
     */
    if (isNamespace) return
    if (config.pruneInterval === false) return

    this.#cleanerWorker = new Worker(new URL('./cleaner_worker.js', import.meta.url), {
      workerData: { directory: this.#directory, pruneInterval: resolveTtl(config.pruneInterval) },
    })

    const logger = this.config.logger?.child({ context: 'bentocache.file-driver' })
    this.#cleanerWorker.on('message', (message) => {
      if (message.type === 'error') {
        ;(logger || console).error({ err: message.error }, 'failed to prune expired items')
      } else if (message.type === 'info') {
        logger?.info(message.message)
      }
    })
  }

  /**
   * A simple mutex to write to the file system to avoid any
   * compromised data
   */
  #runExclusiveKey<T>(key: string, fn: () => Promise<T>) {
    const lock = this.#locks.getOrCreateForKey(key)
    return lock.runExclusive(fn)
  }

  /**
   * Since keys and namespace uses `:` as a separator, we need to
   * purge them from the given path. We replace them with `/` to
   * create a nested directory structure.
   */
  #sanitizePath(path?: string) {
    if (!path) return ''
    return path.replaceAll(':', '/')
  }

  /**
   * Converts the given key to a file path
   */
  #keyToPath(key: string) {
    const keyWithoutPrefix = key.replace(this.prefix, '')

    /**
     * Check if the key contains a relative path
     */
    const re = /(\.\/|\.\.\/)/g
    if (re.test(key)) {
      throw new Error(`Invalid key: ${keyWithoutPrefix}. Should not contain relative paths.`)
    }

    return join(this.#directory, this.#sanitizePath(keyWithoutPrefix))
  }

  /**
   * Check if a file exists at a given path or not
   */
  async #pathExists(path: string) {
    try {
      await access(path)
      return true
    } catch {
      return false
    }
  }

  /**
   * Output a file to the disk and create the directory recursively if
   * it's missing
   */
  async #outputFile(filename: string, content: string) {
    const directory = dirname(filename)
    const pathExists = await this.#pathExists(directory)
    if (!pathExists) {
      await mkdir(directory, { recursive: true })
    }

    await writeFile(filename, content)
  }

  /**
   * Returns a new instance of the driver namespaced
   */
  namespace(namespace: string) {
    return new FileDriver({ ...this.config, prefix: this.createNamespacePrefix(namespace) }, true)
  }

  /**
   * Get a value from the cache
   */
  async get(key: string) {
    key = this.getItemKey(key)

    const path = this.#keyToPath(key)
    const pathExists = await this.#pathExists(path)
    if (!pathExists) return undefined

    const content = await readFile(path, { encoding: 'utf-8' })
    const [value, expire] = JSON.parse(content)

    if (expire !== -1 && expire < Date.now()) {
      await this.delete(key)
      return undefined
    }

    return value as string
  }

  /**
   * Get the value of a key and delete it
   *
   * Returns the value if the key exists, undefined otherwise
   */
  async pull(key: string) {
    const value = await this.get(key)
    if (!value) return undefined

    await this.delete(key)
    return value
  }

  /**
   * Put a value in the cache
   * Returns true if the value was set, false otherwise
   */
  async set(key: string, value: string, ttl?: number) {
    return this.#runExclusiveKey(key, async () => {
      key = this.getItemKey(key)
      await this.#outputFile(
        this.#keyToPath(key),
        JSON.stringify([value, ttl ? Date.now() + ttl : -1]),
      )

      return true
    })
  }

  /**
   * Remove all items from the cache
   */
  async clear() {
    const cacheExists = await this.#pathExists(this.#directory)
    if (!cacheExists) return

    /**
     * By removing the directory and sub-directories, we are also
     * removing the namespaces inside it
     */
    await rm(this.#directory, { recursive: true })
  }

  /**
   * Delete a key from the cache
   * Returns true if the key was deleted, false otherwise
   */
  async delete(key: string) {
    key = this.getItemKey(key)

    const path = this.#keyToPath(key)
    const pathExists = await this.#pathExists(path)
    if (!pathExists) {
      return false
    }

    await rm(path)
    return true
  }

  /**
   * Delete multiple keys from the cache
   */
  async deleteMany(keys: string[]) {
    if (keys.length === 0) return true
    await Promise.all(keys.map((key) => this.delete(key)))
    return true
  }

  async disconnect() {
    await this.#cleanerWorker?.terminate()
  }

  /**
   * Manually prune expired cache entries by scanning the cache directory
   * and removing files that have expired.
   */
  async prune() {
    const cacheExists = await this.#pathExists(this.#directory)
    if (!cacheExists) return

    const { pruneExpiredFiles } = await import('./cleaner.js')
    await pruneExpiredFiles({
      directory: this.#directory,
      onError: (err) => this.config.logger?.error(err),
    })
  }
}
