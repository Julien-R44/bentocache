/*
 * @adonisjs/cache
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { dirname, join } from 'node:path'
import { access, mkdir, readFile, writeFile, rm } from 'node:fs/promises'

import { BaseDriver } from './base_driver.js'
import type { CacheDriver, FileConfig } from '../types/main.js'

export class File extends BaseDriver implements CacheDriver {
  /**
   * Root directory for storing the cache files
   */
  #directory: string

  declare config: FileConfig

  constructor(config: FileConfig) {
    super(config)
    this.#directory = join(config.directory, (config.prefix || '').replaceAll(':', '/'))
  }

  #keyToPath(key: string) {
    const keyWithoutPrefix = key.replace(this.prefix, '')

    let re = /(\.\/|\.\.\/)/g
    if (re.test(key)) {
      throw new Error(`Invalid key: ${keyWithoutPrefix}. Should not contain relative paths.`)
    }

    return join(this.#directory, keyWithoutPrefix.replaceAll(':', '/'))
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
    if (!value) {
      return undefined
    }

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
   * Add the given amount to the value of a key.
   * Creates the key if it doesn't exist
   */
  async add(key: string, amount: number) {
    const currentValue = await this.get(key)
    if (!currentValue) {
      await this.set(key, amount.toString(), this.config.ttl)
      return amount
    }

    const newValue = +currentValue + amount
    await this.set(key, newValue.toString(), this.config.ttl)
    return newValue
  }

  /**
   * Check if a key exists in the cache
   */
  async has(key: string) {
    key = this.getItemKey(key)

    const path = this.#keyToPath(key)
    const pathExists = await this.#pathExists(path)
    if (!pathExists) {
      return false
    }

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
    if (!cacheExists) {
      return
    }

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

  disconnect() {}
}
