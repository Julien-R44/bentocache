/*
 * @quakjs/bentocache
 *
 * (c) Quak
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { pino } from 'pino'
import { setTimeout } from 'node:timers/promises'

export const BASE_URL = new URL('./tmp/', import.meta.url)

export const REDIS_CREDENTIALS = {
  host: process.env.REDIS_HOST!,
  port: Number(process.env.REDIS_PORT),
}

/**
 * Returns a factory that will throw an error when invoked
 */
export function throwingFactory(errorMsg = 'error') {
  return () => {
    throw new Error(errorMsg)
  }
}

/**
 * Returns a factory that will take some time to return the given value
 */
export function waitAndReturnFactory(ms: number, value: any) {
  return async () => {
    await setTimeout(ms)
    return value
  }
}

/**
 * Pino logger that could be injected in
 * cache classes for manual and quick testing
 */
export const traceLogger = (pretty = true) =>
  pino({ level: 'trace', ...(pretty ? { transport: { target: 'pino-pretty' } } : {}) })
