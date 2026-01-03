/*
 * Bentocache
 *
 * (c) Bentocache
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import diagnostics_channel from 'node:diagnostics_channel'

import type { CacheOperationMessage } from './types/tracing_channels.js'

/**
 * Tracing channel for cache operations.
 * Emits start/end events with timing information.
 *
 * Subscribers receive:
 * - start: { operation, key, store }
 * - end: { operation, key, store, hit?, tier?, graced? }
 * - error: { operation, key, store, error }
 *
 * @experimental This API is experimental and may change in future versions.
 */
export const cacheOperation = diagnostics_channel.tracingChannel<
  'bentocache.cache.operation',
  CacheOperationMessage
>('bentocache.cache.operation')
