/*
 * @adonisjs/cache
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import type { CacheSerializer } from '../types/main.js'

/**
 * Simple class to serialize and deserialize values using JSON
 */
export class JsonSerializer implements CacheSerializer {
  async serialize(value: unknown) {
    return JSON.stringify(value)
  }

  async deserialize(value: string) {
    return JSON.parse(value)
  }
}
