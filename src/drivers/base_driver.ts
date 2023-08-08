/*
 * @adonisjs/cache
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import type { DriverCommonOptions } from '../types/main.js'

export abstract class BaseDriver {
  /**
   * Current cache prefix
   */
  protected prefix: string

  constructor(protected config: DriverCommonOptions) {
    this.prefix = this.#sanitizePrefix(config.prefix)
  }

  /**
   * Sanitizes the cache prefix by removing any trailing colons
   */
  #sanitizePrefix(prefix?: string) {
    if (!prefix) return ''
    return prefix.replace(/:+$/, '')
  }

  /**
   * Creates a namespace prefix by concatenating the cache prefix with the given namespace
   * If the cache prefix is not defined, the namespace is returned as is
   */
  protected createNamespacePrefix(namespace: string) {
    const sanitizedPrefix = this.#sanitizePrefix(this.prefix)
    return sanitizedPrefix ? `${sanitizedPrefix}:${namespace}` : namespace
  }

  /**
   * Returns the cache key with the prefix added to it, if a prefix is defined
   */
  protected getItemKey(key: string) {
    return this.prefix ? `${this.prefix}:${key}` : key
  }
}
