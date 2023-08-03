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
  constructor(protected config: DriverCommonOptions) {}

  protected joinPrefixes(...prefixes: string[]) {
    return prefixes.filter((prefix) => prefix).join(':')
  }

  protected getItemKey(key: string) {
    return this.joinPrefixes(this.getPrefix(), key)
  }

  /**
   * Returns the prefix for every key
   */
  protected getPrefix() {
    if (!this.config.prefix) {
      return ''
    }

    return this.config.prefix.replace(/:/, '') + ':'
  }
}
