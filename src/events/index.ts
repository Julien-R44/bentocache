/*
 * @quakjs/bentocache
 *
 * (c) Quak
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

/**
 * Bus events
 */
import { BusMessagePublished } from './bus/bus_message_published.js'
import { BusMessageReceived } from './bus/bus_message_received.js'

/**
 * Cache events
 */
import { CacheHit } from './cache/cache_hit.js'
import { CacheMiss } from './cache/cache_miss.js'
import { CacheCleared } from './cache/cache_cleared.js'
import { CacheDeleted } from './cache/cache_deleted.js'
import { CacheWritten } from './cache/cache_written.js'

export const events = {
  BusMessagePublished,
  BusMessageReceived,
  CacheHit,
  CacheMiss,
  CacheCleared,
  CacheDeleted,
  CacheWritten,
}
