/*
 * @adonisjs/cache
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

export const BASE_URL = new URL('./tmp/', import.meta.url)

export const REDIS_CREDENTIALS = {
  host: process.env.REDIS_HOST,
  port: Number(process.env.REDIS_PORT),
}

export function cleanupCache(cache: { clear(): any; disconnect(): any }) {
  return async () => {
    await cache.clear()
    await cache.disconnect()
  }
}
