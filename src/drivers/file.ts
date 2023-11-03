import { dirname, join } from 'node:path'
import { access, mkdir, readFile, writeFile, rm } from 'node:fs/promises'

import { BaseDriver } from './base_driver.js'
import type { CacheDriver, FileConfig } from '../types/main.js'

/**
 * Caching driver for the filesystem
 *
 * - Each key is stored as a file in the filesystem.
 * - Each namespace is a folder created in the parent namespace
 * - Files are stored in the following format: [stringifiedValue, expireTimestamp]
 * - If the expireTimestamp is -1, the value should never expire
 */
export class File extends BaseDriver implements CacheDriver {
  type = 'l2' as const

  /**
   * Root directory for storing the cache files
   */
  #directory: string

  declare config: FileConfig

  constructor(config: FileConfig) {
    super(config)

    this.#directory = this.#sanitizePath(join(config.directory, config.prefix || ''))
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
    let re = /(\.\/|\.\.\/)/g
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
    return new File({
      ...this.config,
      prefix: this.createNamespacePrefix(namespace),
    })
  }

  /**
   * Get a value from the cache
   */
  async get(key: string) {
    key = this.getItemKey(key)

    const path = this.#keyToPath(key)
    const pathExists = await this.#pathExists(path)
    if (!pathExists) {
      return undefined
    }

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
    key = this.getItemKey(key)
    await this.#outputFile(
      this.#keyToPath(key),
      JSON.stringify([value, ttl ? Date.now() + ttl : -1])
    )

    return true
  }

  /**
   * Check if a key exists in the cache
   */
  async has(key: string) {
    key = this.getItemKey(key)

    /**
     * Check if the file exists
     */
    const path = this.#keyToPath(key)
    const pathExists = await this.#pathExists(path)
    if (!pathExists) return false

    /**
     * Check if the file is expired
     */
    const content = await readFile(path, { encoding: 'utf-8' })
    const [, expire] = JSON.parse(content)

    if (expire !== -1 && expire < Date.now()) {
      await this.delete(key)
      return false
    }

    return true
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
    await Promise.all(keys.map((key) => this.delete(key)))
    return true
  }

  async disconnect() {}
}
